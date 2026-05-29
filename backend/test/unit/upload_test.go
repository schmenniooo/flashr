package unit_test

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	_ "modernc.org/sqlite"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/internal/upload"
	"github.com/smithlabs/flashr/backend/pkg/storage"
)

// uploadRouter creates a test Gin router for the upload service.
// Pass nil aiClient to exercise the "AI not configured" path.
func uploadRouter(aiClient *ai.Client) *gin.Engine {
	r := gin.New()
	api := r.Group("/api")
	noop := func(c *gin.Context) { c.Next() }
	upload.NewService(aiClient, nil).RegisterRoutes(api, func(c *gin.Context) {
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

// ── Markdown upload ──────────────────────────────────────────────────────────

func TestUpload_MD_ValidContent_MockAI(t *testing.T) {
	mockOllama := ollamaServer(t, `[{"question":"What is a goroutine?","answer":"A lightweight thread"}]`)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	md := []byte("# Go Notes\n\nA goroutine is a lightweight thread managed by the Go runtime.\n")
	body, ct := multipartUpload(t, "notes.md", md)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var resp struct {
		Cards []ai.CardDraft `json:"cards"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp.Cards)
}

func TestUpload_MD_EmptyFile_Returns422(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test-model"))

	body, ct := multipartUpload(t, "empty.md", []byte("   \n\t  \n"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_MD_WithStorage_UsesMDKeyAndContentType(t *testing.T) {
	var mu sync.Mutex
	var putCalled, deleteCalled bool
	var storedKey, storedContentType string

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			storedKey = r.URL.Path
			storedContentType = r.Header.Get("Content-Type")
			putCalled = true
			w.Header().Set("ETag", `"etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	mockOllama := ollamaServer(t, `[{"question":"Q","answer":"A"}]`)
	r := uploadRouterWithStorage(ai.NewClient(mockOllama.URL, "test"), store)

	md := []byte("# Study Notes\n\nSome content here.\n")
	body, ct := multipartUpload(t, "study.md", md)
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	r.ServeHTTP(httptest.NewRecorder(), req)

	assert.True(t, putCalled, "storage.Put must be called for every MD upload")
	assert.True(t, deleteCalled, "storage.MustDelete must run as deferred cleanup")
	assert.Contains(t, storedKey, "uploads/")
	assert.Contains(t, storedKey, ".md")
	assert.Contains(t, storedContentType, "text/markdown")
}

// ── Anki (.apkg) upload ──────────────────────────────────────────────────────

// minimalAPKG builds a valid .apkg (ZIP containing a SQLite collection DB)
// with the given front/back card pairs.
func minimalAPKG(t *testing.T, cards []struct{ front, back string }) []byte {
	t.Helper()

	tmp, err := os.CreateTemp("", "anki-test-*.db")
	require.NoError(t, err)
	defer os.Remove(tmp.Name())
	tmp.Close()

	db, err := sql.Open("sqlite", tmp.Name())
	require.NoError(t, err)
	_, err = db.Exec(`CREATE TABLE notes (
		id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER,
		usn INTEGER, tags TEXT, flds TEXT, sfld TEXT, csum INTEGER,
		flags INTEGER, data TEXT)`)
	require.NoError(t, err)
	_, err = db.Exec(`CREATE TABLE cards (
		id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER,
		mod INTEGER, usn INTEGER, type INTEGER, queue INTEGER, due INTEGER,
		ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER,
		odue INTEGER, odid INTEGER, flags INTEGER, data TEXT)`)
	require.NoError(t, err)
	for i, c := range cards {
		flds := c.front + "\x1f" + c.back
		noteID := i + 1
		_, err = db.Exec(
			`INSERT INTO notes VALUES (?,?,1,0,0,'',?,'',0,0,'')`,
			noteID, fmt.Sprintf("guid%d", noteID), flds,
		)
		require.NoError(t, err)
		// One card per note (basic, forward-only template, ord=0).
		_, err = db.Exec(
			`INSERT INTO cards VALUES (?,?,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'')`,
			noteID*100, noteID,
		)
		require.NoError(t, err)
	}
	db.Close()

	dbBytes, err := os.ReadFile(tmp.Name())
	require.NoError(t, err)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	fw, err := zw.Create("collection.anki2")
	require.NoError(t, err)
	_, err = fw.Write(dbBytes)
	require.NoError(t, err)
	zw.Close()
	return buf.Bytes()
}

func TestUpload_APKG_ValidCards_ReturnedDirectly(t *testing.T) {
	// APKG skips AI — pass nil client to prove it is not called.
	r := uploadRouter(nil)

	cards := []struct{ front, back string }{
		{"What is a goroutine?", "A lightweight thread managed by the Go runtime."},
		{"What is a channel?", "A typed conduit for passing values between goroutines."},
	}
	body, ct := multipartUpload(t, "go.apkg", minimalAPKG(t, cards))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var resp struct {
		Cards []ai.CardDraft `json:"cards"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Len(t, resp.Cards, 2)
	assert.Equal(t, "What is a goroutine?", resp.Cards[0].Question)
}

func TestUpload_APKG_EmptyDeck_Returns422(t *testing.T) {
	r := uploadRouter(nil)

	body, ct := multipartUpload(t, "empty.apkg", minimalAPKG(t, nil))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_APKG_InvalidZip_Returns422(t *testing.T) {
	r := uploadRouter(nil)

	body, ct := multipartUpload(t, "corrupt.apkg", []byte("not a zip file"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_APKG_MissingCollectionDB_Returns422(t *testing.T) {
	r := uploadRouter(nil)

	// Valid ZIP but without collection.anki2 or collection.anki21.
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	fw, _ := zw.Create("media")
	fw.Write([]byte("{}"))
	zw.Close()

	body, ct := multipartUpload(t, "nodb.apkg", buf.Bytes())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_APKG_HTMLStrippedFromFields(t *testing.T) {
	r := uploadRouter(nil)

	cards := []struct{ front, back string }{
		{"<b>What is Go?</b>", "<i>A compiled language</i> by Google."},
	}
	body, ct := multipartUpload(t, "go.apkg", minimalAPKG(t, cards))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Cards []ai.CardDraft `json:"cards"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	require.Len(t, resp.Cards, 1)
	assert.Equal(t, "What is Go?", resp.Cards[0].Question)
	assert.Equal(t, "A compiled language by Google.", resp.Cards[0].Answer)
}

func TestUpload_APKG_WithStorage_UsesAPKGKeyAndContentType(t *testing.T) {
	var mu sync.Mutex
	var putCalled, deleteCalled bool
	var storedKey, storedContentType string

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			storedKey = r.URL.Path
			storedContentType = r.Header.Get("Content-Type")
			putCalled = true
			w.Header().Set("ETag", `"etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	// APKG skips AI — nil client is intentional.
	r := uploadRouterWithStorage(nil, store)

	cards := []struct{ front, back string }{{"Q", "A"}}
	body, ct := multipartUpload(t, "deck.apkg", minimalAPKG(t, cards))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	r.ServeHTTP(httptest.NewRecorder(), req)

	assert.True(t, putCalled, "storage.Put must be called for every APKG upload")
	assert.True(t, deleteCalled, "storage.MustDelete must run as deferred cleanup")
	assert.Contains(t, storedKey, "uploads/")
	assert.Contains(t, storedKey, ".apkg")
	assert.Contains(t, storedContentType, "application/zip")
}

// ── Word (.docx) upload ──────────────────────────────────────────────────────

// minimalDOCX builds a valid .docx (ZIP) with a single paragraph of text.
func minimalDOCX(text string) []byte {
	docXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
		`<w:body><w:p><w:r><w:t>` + text + `</w:t></w:r></w:p></w:body></w:document>`

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	fw, _ := zw.Create("word/document.xml")
	fw.Write([]byte(docXML))
	zw.Close()
	return buf.Bytes()
}

func TestUpload_DOCX_ValidContent_MockAI(t *testing.T) {
	mockOllama := ollamaServer(t, `[{"question":"What is a struct?","answer":"A composite data type"}]`)
	r := uploadRouter(ai.NewClient(mockOllama.URL, "test-model"))

	body, ct := multipartUpload(t, "notes.docx", minimalDOCX("Go structs are composite data types."))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var resp struct {
		Cards []ai.CardDraft `json:"cards"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.NotEmpty(t, resp.Cards)
}

func TestUpload_DOCX_EmptyText_Returns422(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test-model"))

	body, ct := multipartUpload(t, "empty.docx", minimalDOCX("   "))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_DOCX_InvalidZip_Returns422(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test-model"))

	// File has .docx extension but is not a valid ZIP archive.
	body, ct := multipartUpload(t, "corrupt.docx", []byte("this is not a zip file"))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_DOCX_MissingDocumentXML_Returns422(t *testing.T) {
	r := uploadRouter(ai.NewClient("http://localhost:11434", "test-model"))

	// Valid ZIP but without word/document.xml inside.
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	fw, _ := zw.Create("word/styles.xml")
	fw.Write([]byte("<w:styles/>"))
	zw.Close()

	body, ct := multipartUpload(t, "nodoc.docx", buf.Bytes())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnprocessableEntity, w.Code)
}

func TestUpload_DOCX_WithStorage_UsesDOCXKeyAndContentType(t *testing.T) {
	var mu sync.Mutex
	var putCalled, deleteCalled bool
	var storedKey, storedContentType string

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			storedKey = r.URL.Path
			storedContentType = r.Header.Get("Content-Type")
			putCalled = true
			w.Header().Set("ETag", `"etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	mockOllama := ollamaServer(t, `[{"question":"Q","answer":"A"}]`)
	r := uploadRouterWithStorage(ai.NewClient(mockOllama.URL, "test"), store)

	body, ct := multipartUpload(t, "report.docx", minimalDOCX("Some document content."))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	r.ServeHTTP(httptest.NewRecorder(), req)

	assert.True(t, putCalled, "storage.Put must be called for every DOCX upload")
	assert.True(t, deleteCalled, "storage.MustDelete must run as deferred cleanup")
	assert.Contains(t, storedKey, "uploads/")
	assert.Contains(t, storedKey, ".docx")
	assert.Contains(t, storedContentType, "wordprocessingml.document")
}

// ── Storage integration ──────────────────────────────────────────────────────

// uploadRouterWithStorage is like uploadRouter but wires a real storage.Client.
func uploadRouterWithStorage(aiClient *ai.Client, store *storage.Client) *gin.Engine {
	r := gin.New()
	api := r.Group("/api")
	noop := func(c *gin.Context) { c.Next() }
	upload.NewService(aiClient, store).RegisterRoutes(api, func(c *gin.Context) {
		c.Set("user_id", "00000000-0000-0000-0000-000000000001")
		c.Next()
	}, noop)
	return r
}

// TestUpload_WithStorage_PutCalledAndCleanedUp verifies that when storage is
// configured, every PDF upload triggers a Put followed by a deferred Delete —
// regardless of whether text extraction or AI generation succeeds.
func TestUpload_WithStorage_PutCalledAndCleanedUp(t *testing.T) {
	var mu sync.Mutex
	var putCalled, deleteCalled bool
	var storedKey string

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			storedKey = r.URL.Path
			putCalled = true
			w.Header().Set("ETag", `"etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	mockOllama := ollamaServer(t, `[{"question":"Q","answer":"A"}]`)
	r := uploadRouterWithStorage(ai.NewClient(mockOllama.URL, "test"), store)

	body, ct := multipartUpload(t, "notes.pdf", minimalPDF())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	r.ServeHTTP(httptest.NewRecorder(), req)

	assert.True(t, putCalled, "storage.Put must be called for every PDF upload")
	assert.True(t, deleteCalled, "storage.MustDelete must run as deferred cleanup")
	assert.Contains(t, storedKey, "uploads/")
	assert.Contains(t, storedKey, ".pdf")
}

// TestUpload_DOCX_WithStorage_PutFails_ProcessingContinues verifies that a
// storage Put failure for a DOCX upload is non-fatal and Delete is not called.
func TestUpload_DOCX_WithStorage_PutFails_ProcessingContinues(t *testing.T) {
	var deleteCalled bool

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusForbidden)
			fmt.Fprint(w, `<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	mockOllama := ollamaServer(t, `[{"question":"Q","answer":"A"}]`)
	r := uploadRouterWithStorage(ai.NewClient(mockOllama.URL, "test"), store)

	body, ct := multipartUpload(t, "notes.docx", minimalDOCX("Some content here."))
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.False(t, deleteCalled, "Delete must not be called when Put failed — nothing was stored")
	assert.NotEqual(t, http.StatusInternalServerError, w.Code, "storage failure must not crash the handler")
}

// TestUpload_WithStorage_PutFails_ProcessingContinues verifies that a storage
// Put failure is non-fatal: processing continues in-memory and Delete is not
// attempted (since nothing was stored).
func TestUpload_WithStorage_PutFails_ProcessingContinues(t *testing.T) {
	var deleteCalled bool

	fakeBucket := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			io.ReadAll(r.Body)
			// 403 is non-retriable — the SDK returns an error immediately.
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusForbidden)
			fmt.Fprint(w, `<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`)
		case http.MethodDelete:
			deleteCalled = true
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(fakeBucket.Close)

	store := storage.New(fakeBucket.URL, "key", "secret", "bucket")
	mockOllama := ollamaServer(t, `[{"question":"Q","answer":"A"}]`)
	r := uploadRouterWithStorage(ai.NewClient(mockOllama.URL, "test"), store)

	body, ct := multipartUpload(t, "notes.pdf", minimalPDF())
	req := httptest.NewRequest(http.MethodPost, "/api/ai/upload", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.False(t, deleteCalled, "Delete must not be called when Put failed — nothing was stored")
	assert.NotEqual(t, http.StatusInternalServerError, w.Code, "storage failure must not crash the handler")
}
