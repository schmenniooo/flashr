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

	cards, err := s.ai.GenerateCardsFromTopic(c.Request.Context(), req.Prompt, req.Count, req.Level, req.LearnerTypes, req.ExistingCards)
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

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	err := s.ai.GenerateCardsFromTopicStream(
		c.Request.Context(),
		req.Prompt, req.Count, req.Level, req.LearnerTypes, req.ExistingCards,
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
		cards, err := extractAPKGCards(data)
		if err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "could not read Anki package"})
			return
		}
		if len(cards) == 0 {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "no cards found in Anki package — the deck may be empty"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"cards": cards})
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

	c.JSON(http.StatusOK, gin.H{"cards": cards, "truncated": truncated})
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

func stripHTML(s string) string {
	s = htmlTagRE.ReplaceAllString(s, "")
	return strings.TrimSpace(html.UnescapeString(s))
}

// extractAPKGCards reads an Anki package (.apkg), opens the embedded SQLite
// collection database, and returns all notes as Q&A card drafts.
// Anki stores fields separated by \x1f; we take field[0] as question and
// field[1] as answer, stripping HTML from both.
//
// Format priority:
//   - collection.anki21b — Anki 2.1.50+; SQLite DB is Zstd-compressed
//   - collection.anki21  — Anki 2.1.x plain SQLite
//   - collection.anki2   — legacy plain SQLite
func extractAPKGCards(data []byte) ([]ai.CardDraft, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("apkg: %w", err)
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
		return nil, errors.New("apkg: no collection database found")
	}

	rc, err := dbFile.Open()
	if err != nil {
		return nil, fmt.Errorf("apkg: %w", err)
	}
	defer rc.Close()

	// SQLite needs a seekable file, so we write to a temp file.
	tmp, err := os.CreateTemp("", "anki-*.db")
	if err != nil {
		return nil, fmt.Errorf("apkg: %w", err)
	}
	defer os.Remove(tmp.Name())

	if isZstd {
		// collection.anki21b is a Zstd-compressed SQLite database.
		compressed, readErr := io.ReadAll(rc)
		if readErr != nil {
			tmp.Close()
			return nil, fmt.Errorf("apkg: %w", readErr)
		}
		dec, newErr := zstd.NewReader(bytes.NewReader(compressed))
		if newErr != nil {
			tmp.Close()
			return nil, fmt.Errorf("apkg: zstd: %w", newErr)
		}
		defer dec.Close()
		if _, copyErr := io.Copy(tmp, dec); copyErr != nil {
			tmp.Close()
			return nil, fmt.Errorf("apkg: zstd decompress: %w", copyErr)
		}
	} else {
		if _, err := io.Copy(tmp, rc); err != nil {
			tmp.Close()
			return nil, fmt.Errorf("apkg: %w", err)
		}
	}
	tmp.Close()

	db, err := sql.Open("sqlite", tmp.Name())
	if err != nil {
		return nil, fmt.Errorf("apkg: %w", err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT flds FROM notes")
	if err != nil {
		return nil, fmt.Errorf("apkg: %w", err)
	}
	defer rows.Close()

	var cards []ai.CardDraft
	for rows.Next() {
		var flds string
		if err := rows.Scan(&flds); err != nil {
			continue
		}
		parts := strings.SplitN(flds, "\x1f", 3)
		if len(parts) < 2 {
			continue
		}
		q := stripHTML(parts[0])
		a := stripHTML(parts[1])
		if q == "" || a == "" {
			continue
		}
		cards = append(cards, ai.CardDraft{Question: q, Answer: a})
	}
	return cards, rows.Err()
}
