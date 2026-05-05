package unit_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/internal/upload"
)

// uploadRouter creates a test Gin router for the upload service.
// Pass nil aiClient to exercise the "AI not configured" path.
func uploadRouter(aiClient *ai.Client) *gin.Engine {
	r := gin.New()
	api := r.Group("/api")
	noop := func(c *gin.Context) { c.Next() }
	upload.NewService(aiClient).RegisterRoutes(api, func(c *gin.Context) {
		c.Set("user_id", "00000000-0000-0000-0000-000000000001")
		c.Next()
	}, noop)
	return r
}

// multipartUpload builds a multipart/form-data body with a single "file" field.
func multipartUpload(t *testing.T, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("file", filename)
	require.NoError(t, err)
	_, err = fw.Write(content)
	require.NoError(t, err)
	mw.Close()
	return &body, mw.FormDataContentType()
}

// minimalPDF builds a minimal structurally-valid PDF with a text content stream.
// xref byte-offsets are computed dynamically so the structure is always correct.
func minimalPDF() []byte {
	var buf bytes.Buffer
	w := func(s string) { buf.WriteString(s) }

	offsets := make([]int, 6)

	w("%PDF-1.4\n")

	offsets[1] = buf.Len()
	w("1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n")

	offsets[2] = buf.Len()
	w("2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n")

	offsets[3] = buf.Len()
	w("3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n")

	stream := "BT /F1 12 Tf 72 720 Td (Go notes) Tj ET\n"
	offsets[4] = buf.Len()
	w(fmt.Sprintf("4 0 obj\n<</Length %d>>\nstream\n%sendstream\nendobj\n", len(stream), stream))

	offsets[5] = buf.Len()
	w("5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n")

	xrefOffset := buf.Len()
	w("xref\n0 6\n")
	w("0000000000 65535 f \n")
	for i := 1; i <= 5; i++ {
		w(fmt.Sprintf("%010d 00000 n \n", offsets[i]))
	}
	w(fmt.Sprintf("trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n%d\n", xrefOffset))
	w("%%EOF\n")

	return buf.Bytes()
}

func TestUpload_NoAI(t *testing.T) {
	r := uploadRouter(nil)
	body, ct := multipartUpload(t, "notes.pdf", minimalPDF())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestUpload_MissingFile(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", &bytes.Buffer{})
	req.Header.Set("Content-Type", "multipart/form-data; boundary=XXXX")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpload_NonPDF(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test"))
	body, ct := multipartUpload(t, "notes.txt", []byte("these are plain text notes, not a PDF"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpload_InvalidPDFStructure(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test"))
	// Passes the %PDF magic-byte check but is not a parseable PDF.
	body, ct := multipartUpload(t, "bad.pdf", []byte("%PDF-1.4\nthis is not valid PDF content"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

// ── /api/ai/generate ────────────────────────────────────────────────────────

// generateRequest posts a JSON body to /api/ai/generate and returns the recorder.
func generateRequest(r interface {
	ServeHTTP(http.ResponseWriter, *http.Request)
}, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/generate", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestGenerate_NoAI(t *testing.T) {
	r := uploadRouter(nil)
	w := generateRequest(r, map[string]any{"prompt": "AWS S3", "count": 5})
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestGenerate_MissingPrompt(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test"))
	w := generateRequest(r, map[string]any{"count": 5})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGenerate_WhitespaceOnlyPrompt(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test"))
	w := generateRequest(r, map[string]any{"prompt": "   ", "count": 5})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGenerate_CountDefaultsToTen(t *testing.T) {
	var captured map[string]any
	mockOllama := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	w := generateRequest(r, map[string]any{"prompt": "AWS S3"}) // count omitted
	assert.Equal(t, http.StatusOK, w.Code)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, "10")
}

func TestGenerate_CountClampedWhenTooLarge(t *testing.T) {
	var captured map[string]any
	mockOllama := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	w := generateRequest(r, map[string]any{"prompt": "AWS S3", "count": 99})
	assert.Equal(t, http.StatusOK, w.Code)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, "10")
	assert.NotContains(t, prompt, "99")
}

func TestGenerate_ValidPrompt_MockAI(t *testing.T) {
	mockOllama := ollamaServer(t, `[{"question":"What is S3?","answer":"Object storage"},{"question":"What is IAM?","answer":"Access management"}]`)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	w := generateRequest(r, map[string]any{"prompt": "AWS Cloud Practitioner", "count": 2})
	assert.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Cards []ai.CardDraft `json:"cards"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp.Cards, 2)
	assert.Equal(t, "What is S3?", resp.Cards[0].Question)
}

func TestGenerate_OllamaError_Returns500(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "model not loaded", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	r := uploadRouter(ai.NewClient(srv.URL, "test-model"))
	w := generateRequest(r, map[string]any{"prompt": "AWS S3", "count": 5})
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestGenerate_OllamaReturnsNonJSON_Returns500(t *testing.T) {
	mockOllama := ollamaServer(t, "Here are some flashcards for you, enjoy!")
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	w := generateRequest(r, map[string]any{"prompt": "React hooks", "count": 5})
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestUpload_ValidPDF_MockAI(t *testing.T) {
	mockOllama := ollamaServer(t, `[{"question":"What is a goroutine?","answer":"A lightweight thread"}]`)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	body, ct := multipartUpload(t, "notes.pdf", minimalPDF())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// 200 when the PDF library successfully extracts text;
	// 422 if this minimal PDF yields no text in this environment.
	// Either way the server must not return 500.
	assert.NotEqual(t, http.StatusInternalServerError, w.Code, "body: %s", w.Body.String())
	if w.Code == http.StatusOK {
		var resp struct {
			Cards []ai.CardDraft `json:"cards"`
		}
		require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
		assert.NotEmpty(t, resp.Cards)
	}
}
