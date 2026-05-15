package unit_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/pkg/storage"
)

// s3Server returns a minimal path-style S3-compatible test server and a
// snapshot function that returns a copy of the current object store.
// It handles PutObject, GetObject, DeleteObject, and HeadBucket.
func s3Server(t *testing.T) (*httptest.Server, func() map[string][]byte) {
	t.Helper()
	var mu sync.Mutex
	objects := make(map[string][]byte)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		key := r.URL.Path
		switch r.Method {
		case http.MethodPut:
			data, _ := io.ReadAll(r.Body)
			objects[key] = data
			w.Header().Set("ETag", `"test-etag"`)
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			data, ok := objects[key]
			if !ok {
				w.Header().Set("Content-Type", "application/xml")
				w.WriteHeader(http.StatusNotFound)
				fmt.Fprint(w, `<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>Not Found</Message></Error>`)
				return
			}
			w.WriteHeader(http.StatusOK)
			w.Write(data)
		case http.MethodDelete:
			delete(objects, key)
			w.WriteHeader(http.StatusNoContent)
		case http.MethodHead:
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	t.Cleanup(srv.Close)

	snapshot := func() map[string][]byte {
		mu.Lock()
		defer mu.Unlock()
		out := make(map[string][]byte, len(objects))
		for k, v := range objects {
			out[k] = append([]byte(nil), v...)
		}
		return out
	}
	return srv, snapshot
}

func newStorageClient(t *testing.T, srv *httptest.Server) *storage.Client {
	t.Helper()
	return storage.New(srv.URL, "testkey", "testsecret", "testbucket")
}

func TestStorage_Put(t *testing.T) {
	srv, snapshot := s3Server(t)
	c := newStorageClient(t, srv)

	err := c.Put(context.Background(), "uploads/test.pdf", []byte("hello pdf"), "application/pdf")
	require.NoError(t, err)

	objects := snapshot()
	require.Contains(t, objects, "/testbucket/uploads/test.pdf")
	assert.Equal(t, []byte("hello pdf"), objects["/testbucket/uploads/test.pdf"])
}

func TestStorage_Put_EmptyBody(t *testing.T) {
	srv, snapshot := s3Server(t)
	c := newStorageClient(t, srv)

	err := c.Put(context.Background(), "uploads/empty.pdf", []byte{}, "application/pdf")
	require.NoError(t, err)
	assert.Contains(t, snapshot(), "/testbucket/uploads/empty.pdf")
}

func TestStorage_Get(t *testing.T) {
	srv, _ := s3Server(t)
	c := newStorageClient(t, srv)

	require.NoError(t, c.Put(context.Background(), "uploads/test.pdf", []byte("file content"), "application/pdf"))

	data, err := c.Get(context.Background(), "uploads/test.pdf")
	require.NoError(t, err)
	assert.Equal(t, []byte("file content"), data)
}

func TestStorage_Get_NotFound(t *testing.T) {
	srv, _ := s3Server(t)
	c := newStorageClient(t, srv)

	_, err := c.Get(context.Background(), "uploads/missing.pdf")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "uploads/missing.pdf")
}

func TestStorage_Delete(t *testing.T) {
	srv, snapshot := s3Server(t)
	c := newStorageClient(t, srv)

	require.NoError(t, c.Put(context.Background(), "uploads/test.pdf", []byte("data"), "application/pdf"))
	require.Contains(t, snapshot(), "/testbucket/uploads/test.pdf")

	require.NoError(t, c.Delete(context.Background(), "uploads/test.pdf"))
	assert.NotContains(t, snapshot(), "/testbucket/uploads/test.pdf")
}

func TestStorage_Ping_Success(t *testing.T) {
	srv, _ := s3Server(t)
	c := newStorageClient(t, srv)
	assert.NoError(t, c.Ping(context.Background()))
}

func TestStorage_Ping_Unreachable(t *testing.T) {
	srv, _ := s3Server(t)
	srv.Close() // shut down before pinging
	c := newStorageClient(t, srv)
	assert.Error(t, c.Ping(context.Background()))
}

func TestStorage_MustDelete_Success(t *testing.T) {
	srv, snapshot := s3Server(t)
	c := newStorageClient(t, srv)

	require.NoError(t, c.Put(context.Background(), "uploads/x.pdf", []byte("x"), "application/pdf"))
	c.MustDelete(context.Background(), "uploads/x.pdf")
	assert.NotContains(t, snapshot(), "/testbucket/uploads/x.pdf")
}

func TestStorage_MustDelete_DoesNotPanicOnError(t *testing.T) {
	srv, _ := s3Server(t)
	srv.Close()
	c := newStorageClient(t, srv)
	assert.NotPanics(t, func() {
		c.MustDelete(context.Background(), "uploads/x.pdf")
	})
}

func TestStorage_PutGet_RoundTrip(t *testing.T) {
	srv, _ := s3Server(t)
	c := newStorageClient(t, srv)

	payload := []byte("%PDF-1.4 binary content here")
	require.NoError(t, c.Put(context.Background(), "uploads/round.pdf", payload, "application/pdf"))

	got, err := c.Get(context.Background(), "uploads/round.pdf")
	require.NoError(t, err)
	assert.Equal(t, payload, got)
}
