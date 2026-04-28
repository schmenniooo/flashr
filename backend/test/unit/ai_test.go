package unit_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/ai"
)

// ollamaServer returns a test HTTP server that wraps the given text in the
// Ollama /api/generate response envelope.
func ollamaServer(t *testing.T, responseText string) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := json.Marshal(map[string]string{"response": responseText})
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestGenerateCards_ValidJSON(t *testing.T) {
	srv := ollamaServer(t, `[{"question":"What is Go?","answer":"A compiled language"},{"question":"What is a goroutine?","answer":"A lightweight concurrent thread"}]`)
	client := ai.NewClient(srv.URL, "test-model")

	cards, err := client.GenerateCards(context.Background(), "Go programming notes")
	require.NoError(t, err)
	assert.Len(t, cards, 2)
	assert.Equal(t, "What is Go?", cards[0].Question)
	assert.Equal(t, "A compiled language", cards[0].Answer)
}

func TestGenerateCards_JSONWrappedInText(t *testing.T) {
	srv := ollamaServer(t, "Here are your flashcards:\n[{\"question\":\"Q1\",\"answer\":\"A1\"}]\nHope that helps!")
	client := ai.NewClient(srv.URL, "test-model")

	cards, err := client.GenerateCards(context.Background(), "some notes")
	require.NoError(t, err)
	require.Len(t, cards, 1)
	assert.Equal(t, "Q1", cards[0].Question)
}

func TestGenerateCards_FiltersEmptyPairs(t *testing.T) {
	srv := ollamaServer(t, `[{"question":"Good Q","answer":"Good A"},{"question":"","answer":"orphan"},{"question":"another","answer":""}]`)
	client := ai.NewClient(srv.URL, "test-model")

	cards, err := client.GenerateCards(context.Background(), "notes")
	require.NoError(t, err)
	assert.Len(t, cards, 1)
	assert.Equal(t, "Good Q", cards[0].Question)
}

func TestGenerateCards_NoArrayInResponse(t *testing.T) {
	srv := ollamaServer(t, "The model forgot to return JSON.")
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCards(context.Background(), "notes")
	assert.Error(t, err)
}

func TestGenerateCards_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCards(context.Background(), "notes")
	assert.Error(t, err)
}
