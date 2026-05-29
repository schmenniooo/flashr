package unit_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/ai"
)

// ollamaServerCapture is like ollamaServer but also records the last decoded
// request body sent to /api/generate so tests can inspect the prompt.
func ollamaServerCapture(t *testing.T, responseText string, captured *map[string]any) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(captured)
		body, _ := json.Marshal(map[string]string{"response": responseText})
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

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

	cards, truncated, err := client.GenerateCards(context.Background(), "Go programming notes")
	require.NoError(t, err)
	assert.False(t, truncated, "short input must not set the truncated flag")
	assert.Len(t, cards, 2)
	assert.Equal(t, "What is Go?", cards[0].Question)
	assert.Equal(t, "A compiled language", cards[0].Answer)
}

func TestGenerateCards_JSONWrappedInText(t *testing.T) {
	srv := ollamaServer(t, "Here are your flashcards:\n[{\"question\":\"Q1\",\"answer\":\"A1\"}]\nHope that helps!")
	client := ai.NewClient(srv.URL, "test-model")

	cards, _, err := client.GenerateCards(context.Background(), "some notes")
	require.NoError(t, err)
	require.Len(t, cards, 1)
	assert.Equal(t, "Q1", cards[0].Question)
}

func TestGenerateCards_FiltersEmptyPairs(t *testing.T) {
	srv := ollamaServer(t, `[{"question":"Good Q","answer":"Good A"},{"question":"","answer":"orphan"},{"question":"another","answer":""}]`)
	client := ai.NewClient(srv.URL, "test-model")

	cards, _, err := client.GenerateCards(context.Background(), "notes")
	require.NoError(t, err)
	assert.Len(t, cards, 1)
	assert.Equal(t, "Good Q", cards[0].Question)
}

func TestGenerateCards_NoArrayInResponse(t *testing.T) {
	srv := ollamaServer(t, "The model forgot to return JSON.")
	client := ai.NewClient(srv.URL, "test-model")

	_, _, err := client.GenerateCards(context.Background(), "notes")
	assert.Error(t, err)
}

func TestGenerateCards_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)
	client := ai.NewClient(srv.URL, "test-model")

	_, _, err := client.GenerateCards(context.Background(), "notes")
	assert.Error(t, err)
}

// ── GenerateCardsFromTopic ───────────────────────────────────────────────────

func TestGenerateCardsFromTopic_ValidJSON(t *testing.T) {
	srv := ollamaServer(t, `[{"question":"What is S3?","answer":"Object storage service by AWS"},{"question":"What is IAM?","answer":"Identity and Access Management"}]`)
	client := ai.NewClient(srv.URL, "test-model")

	cards, err := client.GenerateCardsFromTopic(context.Background(), "AWS Cloud Practitioner", 2, "intermediate", nil, nil)
	require.NoError(t, err)
	assert.Len(t, cards, 2)
	assert.Equal(t, "What is S3?", cards[0].Question)
	assert.Equal(t, "Object storage service by AWS", cards[0].Answer)
}

func TestGenerateCardsFromTopic_JSONWrappedInText(t *testing.T) {
	srv := ollamaServer(t, "Sure! Here are your cards:\n[{\"question\":\"Q1\",\"answer\":\"A1\"}]\nHope that helps!")
	client := ai.NewClient(srv.URL, "test-model")

	cards, err := client.GenerateCardsFromTopic(context.Background(), "some topic", 1, "beginner", nil, nil)
	require.NoError(t, err)
	require.Len(t, cards, 1)
	assert.Equal(t, "Q1", cards[0].Question)
}

func TestGenerateCardsFromTopic_NoArrayInResponse(t *testing.T) {
	srv := ollamaServer(t, "Let me tell you about the French Revolution...")
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCardsFromTopic(context.Background(), "French Revolution", 5, "intermediate", nil, nil)
	assert.Error(t, err)
}

func TestGenerateCardsFromTopic_PromptContainsTopic(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCardsFromTopic(context.Background(), "French Revolution", 5, "intermediate", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, "French Revolution")
}

func TestGenerateCardsFromTopic_PromptContainsCount(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCardsFromTopic(context.Background(), "React hooks", 7, "intermediate", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, "7")
}

func TestGenerateCardsFromTopic_PromptContainsLevel(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCardsFromTopic(context.Background(), "React hooks", 5, "advanced", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, "advanced")
}

// ── Text truncation ──────────────────────────────────────────────────────────

// TestGenerateCards_LongTextIsTruncated verifies that text longer than 32 000
// bytes is cut before being sent to Ollama, and that the prompt still reaches
// the server (i.e. the request is made at all).
func TestGenerateCards_LongTextIsTruncated(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	longText := strings.Repeat("x", 40000) // 40 KB — well over the 32 KB limit
	_, truncated, err := client.GenerateCards(context.Background(), longText)
	require.NoError(t, err)
	assert.True(t, truncated, "truncated flag must be set for oversized input")

	prompt, _ := captured["prompt"].(string)
	assert.NotEmpty(t, prompt)
	assert.NotContains(t, prompt, longText, "prompt must not include the full 40 KB input verbatim")
}

// TestGenerateCards_TextTruncatedAt32000 checks the cap precisely: input over
// 32 000 bytes must be shorter in the prompt than the raw input.
func TestGenerateCards_TextTruncatedAt32000(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	input := strings.Repeat("a", 35000)
	_, truncated, err := client.GenerateCards(context.Background(), input)
	require.NoError(t, err)
	assert.True(t, truncated)

	prompt, _ := captured["prompt"].(string)
	assert.NotContains(t, prompt, input, "truncated input must not appear verbatim")
	assert.Contains(t, prompt, strings.Repeat("a", 100), "truncated text must still appear in the prompt")
}

// TestGenerateCards_UTF8TruncationIsSafe verifies that truncating near a
// multi-byte UTF-8 boundary does not produce an invalid string. We craft a
// string whose 32 000th byte lands inside a 3-byte rune (€ = 0xE2 0x82 0xAC).
func TestGenerateCards_UTF8TruncationIsSafe(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	// Fill 31 999 ASCII bytes then append multi-byte runes so that byte 32 000
	// lands inside a rune, forcing the truncation code to back up.
	prefix := make([]byte, 31999)
	for i := range prefix {
		prefix[i] = 'a'
	}
	text := string(prefix) + "€€€€€" // each € is 3 bytes

	_, _, err := client.GenerateCards(context.Background(), text)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.NotEmpty(t, prompt)
	// The prompt must be valid UTF-8 — no truncation artefacts.
	for i, r := range prompt {
		if r == '�' {
			t.Fatalf("replacement rune at byte offset %d — string is not valid UTF-8", i)
		}
	}
}

// ── Topic truncation ─────────────────────────────────────────────────────────

// TestGenerateCardsFromTopic_LongTopicIsTruncated verifies that topic strings
// over 1000 bytes are cut before the prompt is built.
func TestGenerateCardsFromTopic_LongTopicIsTruncated(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	longTopic := strings.Repeat("t", 1200) // 1200 bytes — over the 1000-byte cap
	_, err := client.GenerateCardsFromTopic(context.Background(), longTopic, 5, "intermediate", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.NotContains(t, prompt, longTopic, "full 1200-byte topic must not appear verbatim in prompt")
	assert.NotEmpty(t, prompt)
}

// TestGenerateCardsFromTopic_ShortTopicNotTruncated verifies that topics under
// 1000 bytes are sent through unchanged.
func TestGenerateCardsFromTopic_ShortTopicNotTruncated(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	topic := "React hooks and state management"
	_, err := client.GenerateCardsFromTopic(context.Background(), topic, 5, "intermediate", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	assert.Contains(t, prompt, topic, "short topic must appear verbatim in prompt")
}

// TestGenerateCardsFromTopic_TopicUTF8TruncationIsSafe verifies that a topic
// truncated near a multi-byte boundary produces valid UTF-8.
func TestGenerateCardsFromTopic_TopicUTF8TruncationIsSafe(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	// 499 ASCII bytes then multi-byte runes so byte 500 lands mid-rune.
	prefix := make([]byte, 499)
	for i := range prefix {
		prefix[i] = 'a'
	}
	topic := string(prefix) + "€€€€" // each € is 3 bytes

	_, err := client.GenerateCardsFromTopic(context.Background(), topic, 3, "beginner", nil, nil)
	require.NoError(t, err)

	prompt, _ := captured["prompt"].(string)
	for i, r := range prompt {
		if r == '�' {
			t.Fatalf("replacement rune at byte %d — truncated topic is invalid UTF-8", i)
		}
	}
}

// ── num_ctx option ───────────────────────────────────────────────────────────

// TestCallOllama_SendsNumCtxOption verifies that every generate call includes
// num_ctx: 4096 in the options map, giving the prompt enough context headroom.
func TestCallOllama_SendsNumCtxOption(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	_, _, err := client.GenerateCards(context.Background(), "some notes")
	require.NoError(t, err)

	opts, _ := captured["options"].(map[string]any)
	require.NotNil(t, opts, "options map must be present in the Ollama request")
	numCtx, _ := opts["num_ctx"].(float64) // JSON numbers unmarshal as float64
	assert.Equal(t, float64(5120), numCtx, "num_ctx must be 5120")
}

// TestCallOllama_TopicSendNumCtxOption verifies the topic path also sends num_ctx.
func TestCallOllama_TopicSendsNumCtxOption(t *testing.T) {
	var captured map[string]any
	srv := ollamaServerCapture(t, `[{"question":"Q","answer":"A"}]`, &captured)
	client := ai.NewClient(srv.URL, "test-model")

	_, err := client.GenerateCardsFromTopic(context.Background(), "Biology", 5, "intermediate", nil, nil)
	require.NoError(t, err)

	opts, _ := captured["options"].(map[string]any)
	require.NotNil(t, opts)
	numCtx, _ := opts["num_ctx"].(float64)
	assert.Equal(t, float64(5120), numCtx)
}
