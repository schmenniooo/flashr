// Package upload handles file ingestion and text extraction for AI card generation.
package upload

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/ledongthuc/pdf"

	"github.com/smithlabs/flashr/backend/internal/ai"
)

const maxFileSize = 20 << 20 // 20 MB

// Service wires the upload endpoint to the AI client.
type Service struct {
	ai *ai.Client
}

// NewService creates a Service backed by the given AI client.
func NewService(aiClient *ai.Client) *Service {
	return &Service{ai: aiClient}
}

// RegisterRoutes mounts the upload endpoints under /api with auth middleware.
func (s *Service) RegisterRoutes(api *gin.RouterGroup, authMW gin.HandlerFunc) {
	g := api.Group("/ai", authMW)
	g.POST("/upload", s.handleUpload)
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

	if !isPDF(data) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type — only PDF is supported right now"})
		return
	}

	text, err := extractPDFText(data)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "could not extract text from PDF — try a text-based PDF"})
		return
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
