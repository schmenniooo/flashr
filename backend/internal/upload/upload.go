// Package upload handles file ingestion and text extraction for AI card generation.
package upload

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ledongthuc/pdf"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/pkg/storage"
)

const maxFileSize = 20 << 20 // 20 MB

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
	if s.ai == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI generation is not configured — OLLAMA_URL is missing"})
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	if fh.Size > maxFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large — max 20 MB"})
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
	if !isMD && !isDOCX && !isPDF(data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type — only PDF, Markdown (.md) and Word (.docx) are supported"})
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
		}
		key := "uploads/" + uuid.New().String() + ext
		if putErr := s.storage.Put(c.Request.Context(), key, data, mime); putErr == nil {
			defer s.storage.MustDelete(context.Background(), key)
		}
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

	cards, err := s.ai.GenerateCards(c.Request.Context(), text)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI generation failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cards": cards})
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
