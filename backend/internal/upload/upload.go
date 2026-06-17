// Package upload handles file ingestion and text extraction for AI card generation.
package upload

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/klauspost/compress/zstd"
	"github.com/ledongthuc/pdf"
	_ "modernc.org/sqlite"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/pkg/storage"
)

const maxFileSize = 500 << 20 // 500 MB

// Service wires the upload endpoint to the AI client.
type Service struct {
	ai      *ai.Client
	storage *storage.Client // optional; nil → in-memory only, no persistence
}

// NewService creates a Service backed by the given AI client.
// store may be nil, in which case uploads are processed fully in-memory.
func NewService(aiClient *ai.Client, store *storage.Client) *Service {
	return &Service{ai: aiClient, storage: store}
}

// RegisterRoutes mounts the upload endpoints under /api.
// Both AI endpoints require auth + pro plan.
func (s *Service) RegisterRoutes(api *gin.RouterGroup, authMW gin.HandlerFunc, requirePro gin.HandlerFunc) {
	g := api.Group("/ai", authMW, requirePro)
	g.POST("/upload", s.handleUpload)
	g.POST("/upload/stream", s.handleUploadStream)
	g.POST("/generate", s.handleGenerate)
	g.POST("/generate/stream", s.handleGenerateStream)
}

func validLevel(l string) string {
	switch l {
	case "beginner", "intermediate", "advanced":
		return l
	default:
		return "intermediate"
	}
}

func (s *Service) handleGenerate(c *gin.Context) {
	if s.ai == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI generation is not configured — OLLAMA_URL is missing"})
		return
	}

	var req struct {
		Prompt        string         `json:"prompt"`
		Count         int            `json:"count"`
		Level         string         `json:"level"`
		LearnerTypes  []string       `json:"learnerTypes"`
		ExistingCards []ai.CardDraft `json:"existingCards"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prompt is required"})
		return
	}
	if req.Count <= 0 || req.Count > 20 {
		req.Count = 10
	}
	req.Level = validLevel(req.Level)

	cards, err := s.ai.GenerateCardsFromTopic(c.Request.Context(), req.Prompt, req.Count, req.Level, req.LearnerTypes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI generation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cards": cards})
}

func (s *Service) handleGenerateStream(c *gin.Context) {
	if s.ai == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI generation is not configured — OLLAMA_URL is missing"})
		return
	}

	var req struct {
		Prompt       string   `json:"prompt"`
		Count        int      `json:"count"`
		Level        string   `json:"level"`
		LearnerTypes []string `json:"learnerTypes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Prompt) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "prompt is required"})
		return
	}
	if req.Count <= 0 || req.Count > 20 {
		req.Count = 10
	}
	req.Level = validLevel(req.Level)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	err := s.ai.GenerateCardsFromTopicStream(
		c.Request.Context(),
		req.Prompt, req.Count, req.Level, req.LearnerTypes,
		func(card ai.CardDraft) {
			c.SSEvent("card", card)
			c.Writer.Flush()
		},
	)

	if err != nil && !errors.Is(err, context.Canceled) {
		c.SSEvent("error", gin.H{"error": "AI generation failed: " + err.Error()})
		c.Writer.Flush()
		return
	}

	c.SSEvent("done", gin.H{})
	c.Writer.Flush()
}

func (s *Service) handleUpload(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	if fh.Size > maxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large — max 500 MB"})
		return
	}

	f, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open file"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read file"})
		return
	}

	nameLower := strings.ToLower(fh.Filename)
	isMD := strings.HasSuffix(nameLower, ".md")
	isDOCX := strings.HasSuffix(nameLower, ".docx")
	isAPKG := strings.HasSuffix(nameLower, ".apkg")
	if !isMD && !isDOCX && !isAPKG && !isPDF(data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type — only PDF, Markdown (.md), Word (.docx) and Anki (.apkg) are supported"})
		return
	}

	// Persist to bucket while processing. The deferred delete ensures cleanup
	// regardless of whether extraction or AI generation succeeds or fails.
	// Falls back to in-memory if storage is not configured.
	if s.storage != nil {
		ext, mime := ".pdf", "application/pdf"
		switch {
		case isMD:
			ext, mime = ".md", "text/markdown"
		case isDOCX:
			ext, mime = ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case isAPKG:
			ext, mime = ".apkg", "application/zip"
		}
		key := "uploads/" + uuid.New().String() + ext
		if putErr := s.storage.Put(c.Request.Context(), key, data, mime); putErr == nil {
			defer s.storage.MustDelete(context.Background(), key)
		}
	}

	// Anki packages already contain Q&A pairs — import directly without AI.
	if isAPKG {
		cards, skipped, err := extractAPKGCards(data)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "could not read Anki package"})
			return
		}
		if len(cards) == 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no cards found in Anki package — the deck may be empty or contain only image/unsupported note types"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"cards": cards, "skipped": skipped})
		return
	}

	if s.ai == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI generation is not configured — OLLAMA_URL is missing"})
		return
	}

	var text string
	switch {
	case isMD:
		text = string(data)
	case isDOCX:
		text, err = extractDOCXText(data)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "could not extract text from Word document"})
			return
		}
	default:
		text, err = extractPDFText(data)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "could not extract text from PDF — try a text-based PDF"})
			return
		}
	}

	if strings.TrimSpace(text) == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no text found in file — the PDF may be scanned or image-only"})
		return
	}

	cards, truncated, err := s.ai.GenerateCards(c.Request.Context(), text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI generation failed: " + err.Error()})
		return
	}
	if len(cards) == 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no flashcard pairs could be generated — try a clearer or longer text"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cards": cards, "truncated": truncated})
}

func (s *Service) handleUploadStream(c *gin.Context) {
	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	if fh.Size > maxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large — max 500 MB"})
		return
	}

	f, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not open file"})
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read file"})
		return
	}

	nameLower := strings.ToLower(fh.Filename)
	isMD := strings.HasSuffix(nameLower, ".md")
	isDOCX := strings.HasSuffix(nameLower, ".docx")
	isAPKG := strings.HasSuffix(nameLower, ".apkg")
	if !isMD && !isDOCX && !isAPKG && !isPDF(data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type — only PDF, Markdown (.md), Word (.docx) and Anki (.apkg) are supported"})
		return
	}

	if s.storage != nil {
		ext, mime := ".pdf", "application/pdf"
		switch {
		case isMD:
			ext, mime = ".md", "text/markdown"
		case isDOCX:
			ext, mime = ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		case isAPKG:
			ext, mime = ".apkg", "application/zip"
		}
		key := "uploads/" + uuid.New().String() + ext
		if putErr := s.storage.Put(c.Request.Context(), key, data, mime); putErr == nil {
			defer s.storage.MustDelete(context.Background(), key)
		}
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	emit := func(event string, payload any) {
		c.SSEvent(event, payload)
		c.Writer.Flush()
	}

	// APKG: no AI needed — stream cards directly from the parsed deck.
	if isAPKG {
		cards, skipped, err := extractAPKGCards(data)
		if err != nil {
			emit("error", gin.H{"error": "could not read Anki package"})
			return
		}
		if len(cards) == 0 {
			emit("error", gin.H{"error": "no cards found in Anki package — the deck may be empty or contain only image/unsupported note types"})
			return
		}
		for _, card := range cards {
			emit("card", card)
		}
		emit("meta", gin.H{"skipped": skipped})
		emit("done", gin.H{})
		return
	}

	if s.ai == nil {
		emit("error", gin.H{"error": "AI generation is not configured — OLLAMA_URL is missing"})
		return
	}

	var text string
	switch {
	case isMD:
		text = string(data)
	case isDOCX:
		text, err = extractDOCXText(data)
		if err != nil {
			emit("error", gin.H{"error": "could not extract text from Word document"})
			return
		}
	default:
		text, err = extractPDFText(data)
		if err != nil {
			emit("error", gin.H{"error": "could not extract text from PDF — try a text-based PDF"})
			return
		}
	}

	if strings.TrimSpace(text) == "" {
		emit("error", gin.H{"error": "no text found in file — the PDF may be scanned or image-only"})
		return
	}

	cardCount := 0
	truncated, genErr := s.ai.GenerateCardsStream(c.Request.Context(), text, func(card ai.CardDraft) {
		cardCount++
		emit("card", card)
	})

	if genErr != nil && !errors.Is(genErr, context.Canceled) {
		if cardCount == 0 {
			emit("error", gin.H{"error": "AI generation failed: " + genErr.Error()})
			return
		}
		// Partial success — emit what we got with a warning.
		emit("meta", gin.H{"truncated": truncated, "warning": "AI generation ended early — some cards may be missing"})
		emit("done", gin.H{})
		return
	}

	if cardCount == 0 {
		emit("error", gin.H{"error": "no flashcard pairs could be generated — try a clearer or longer text"})
		return
	}

	emit("meta", gin.H{"truncated": truncated})
	emit("done", gin.H{})
}

func isPDF(data []byte) bool {
	return bytes.HasPrefix(data, []byte("%PDF"))
}

func extractDOCXText(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("docx: %w", err)
	}

	var docFile *zip.File
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			docFile = f
			break
		}
	}
	if docFile == nil {
		return "", errors.New("docx: word/document.xml not found")
	}

	rc, err := docFile.Open()
	if err != nil {
		return "", fmt.Errorf("docx: %w", err)
	}
	defer rc.Close()

	var sb strings.Builder
	dec := xml.NewDecoder(rc)
	inText := false
	for {
		tok, err := dec.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("docx: %w", err)
		}
		switch t := tok.(type) {
		case xml.StartElement:
			inText = t.Name.Local == "t"
		case xml.EndElement:
			if t.Name.Local == "p" {
				sb.WriteByte('\n')
			}
			if t.Name.Local == "t" {
				inText = false
			}
		case xml.CharData:
			if inText {
				sb.Write(t)
			}
		}
	}
	return sb.String(), nil
}

func extractPDFText(data []byte) (string, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("pdf reader: %w", err)
	}

	var sb strings.Builder
	for i := 1; i <= r.NumPage(); i++ {
		p := r.Page(i)
		if p.V.IsNull() {
			continue
		}
		text, err := p.GetPlainText(nil)
		if err != nil {
			continue // skip unreadable pages
		}
		sb.WriteString(text)
		sb.WriteByte('\n')
	}
	return sb.String(), nil
}

var htmlTagRE = regexp.MustCompile(`<[^>]*>`)

// clozeRE matches Anki cloze deletion markers: {{c1::answer}} or {{c1::answer::hint}}
var clozeRE = regexp.MustCompile(`\{\{c(\d+)::([^:}]+)(?:::[^}]*)?\}\}`)

func stripHTML(s string) string {
	s = htmlTagRE.ReplaceAllString(s, "")
	return strings.TrimSpace(html.UnescapeString(s))
}

// clozeToCards converts an Anki cloze note into one CardDraft per cloze deletion.
// For each unique c-number, the question replaces that marker with ___ and fills
// the others with their answer text. The extra back field is appended to the answer.
func clozeToCards(front, back string) []ai.CardDraft {
	allMatches := clozeRE.FindAllStringSubmatch(front, -1)
	if len(allMatches) == 0 {
		return nil
	}

	// Collect unique cloze numbers in order of first appearance.
	seen := map[string]bool{}
	var nums []string
	answers := map[string]string{}
	for _, m := range allMatches {
		num, answer := m[1], m[2]
		if !seen[num] {
			seen[num] = true
			nums = append(nums, num)
		}
		if answers[num] == "" {
			answers[num] = answer
		}
	}

	hint := stripHTML(back)
	var cards []ai.CardDraft
	for _, num := range nums {
		q := clozeRE.ReplaceAllStringFunc(front, func(m string) string {
			sub := clozeRE.FindStringSubmatch(m)
			if len(sub) < 2 {
				return m
			}
			if sub[1] == num {
				return "___"
			}
			// Other cloze markers — reveal their answer text.
			if len(sub) >= 3 {
				return sub[2]
			}
			return m
		})
		q = stripHTML(q)
		a := stripHTML(answers[num])
		if hint != "" {
			a = a + "\n" + hint
		}
		if q != "" && a != "" {
			cards = append(cards, ai.CardDraft{Question: q, Answer: a})
		}
	}
	return cards
}

// extractAPKGCards reads an Anki package (.apkg), opens the embedded SQLite
// collection database, and returns all card drafts plus a count of skipped notes.
//
// Card generation rules:
//   - Cloze notes (fields contain {{c1::...}}) → one card per cloze deletion.
//   - Notes with 2+ cards in the cards table → forward card + reverse card.
//   - All other notes → single forward card (field[0] Q, field[1] A).
//
// Format priority:
//   - collection.anki21b — Anki 2.1.50+; SQLite DB is Zstd-compressed
//   - collection.anki21  — Anki 2.1.x plain SQLite
//   - collection.anki2   — legacy plain SQLite
func extractAPKGCards(data []byte) ([]ai.CardDraft, int, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, 0, fmt.Errorf("apkg: %w", err)
	}

	// Prefer anki21b > anki21 > anki2.
	// collection.anki21b (Anki 2.1.50+) is a Zstd-compressed SQLite database.
	var dbFile *zip.File
	var isZstd bool
	rank := func(name string) int {
		switch name {
		case "collection.anki21b":
			return 3
		case "collection.anki21":
			return 2
		case "collection.anki2":
			return 1
		}
		return 0
	}
	for _, f := range zr.File {
		if r := rank(f.Name); r > 0 && (dbFile == nil || r > rank(dbFile.Name)) {
			dbFile = f
			isZstd = f.Name == "collection.anki21b"
		}
	}
	if dbFile == nil {
		return nil, 0, errors.New("apkg: no collection database found")
	}

	rc, err := dbFile.Open()
	if err != nil {
		return nil, 0, fmt.Errorf("apkg: %w", err)
	}
	defer rc.Close()

	// SQLite needs a seekable file, so we write to a temp file.
	tmp, err := os.CreateTemp("", "anki-*.db")
	if err != nil {
		return nil, 0, fmt.Errorf("apkg: %w", err)
	}
	defer os.Remove(tmp.Name())

	if isZstd {
		compressed, readErr := io.ReadAll(rc)
		if readErr != nil {
			tmp.Close()
			return nil, 0, fmt.Errorf("apkg: %w", readErr)
		}
		dec, newErr := zstd.NewReader(bytes.NewReader(compressed))
		if newErr != nil {
			tmp.Close()
			return nil, 0, fmt.Errorf("apkg: zstd: %w", newErr)
		}
		defer dec.Close()
		if _, copyErr := io.Copy(tmp, dec); copyErr != nil {
			tmp.Close()
			return nil, 0, fmt.Errorf("apkg: zstd decompress: %w", copyErr)
		}
	} else {
		if _, err := io.Copy(tmp, rc); err != nil {
			tmp.Close()
			return nil, 0, fmt.Errorf("apkg: %w", err)
		}
	}
	tmp.Close()

	db, err := sql.Open("sqlite", tmp.Name())
	if err != nil {
		return nil, 0, fmt.Errorf("apkg: %w", err)
	}
	defer db.Close()

	// Join notes with cards to get the card count per note.
	// card_count > 1 on a non-cloze note means it has a reverse template.
	// For cloze notes, card_count equals the number of unique cloze deletions.
	rows, err := db.Query(`
		SELECT n.flds, COUNT(c.id) AS card_count
		FROM notes n
		LEFT JOIN cards c ON c.nid = n.id
		GROUP BY n.id, n.flds`)
	if err != nil {
		return nil, 0, fmt.Errorf("apkg: %w", err)
	}
	defer rows.Close()

	var cards []ai.CardDraft
	skipped := 0
	for rows.Next() {
		var flds string
		var cardCount int
		if err := rows.Scan(&flds, &cardCount); err != nil {
			skipped++
			continue
		}
		parts := strings.SplitN(flds, "\x1f", 3)
		if len(parts) < 1 {
			skipped++
			continue
		}
		front := parts[0]
		back := ""
		if len(parts) >= 2 {
			back = parts[1]
		}

		// Cloze notes: convert each deletion to its own card.
		if clozeRE.MatchString(front) {
			clozeCards := clozeToCards(front, back)
			if len(clozeCards) == 0 {
				skipped++
			} else {
				cards = append(cards, clozeCards...)
			}
			continue
		}

		q := stripHTML(front)
		a := stripHTML(back)
		if q == "" || a == "" {
			skipped++
			continue
		}
		cards = append(cards, ai.CardDraft{Question: q, Answer: a})

		// Notes with more than one card have a reverse template — add reverse.
		if cardCount >= 2 {
			cards = append(cards, ai.CardDraft{Question: a, Answer: q})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, skipped, fmt.Errorf("apkg: %w", err)
	}
	return cards, skipped, nil
}
