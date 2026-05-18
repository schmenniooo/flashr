// Package ai provides the Ollama client and flashcard generation logic.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

// CardDraft is a single generated question-answer pair.
type CardDraft struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

// Client talks to a locally-hosted Ollama instance.
type Client struct {
	baseURL string
	model   string
	http    *http.Client
}

// NewClient creates a Client. model is the Ollama model tag (e.g. "llama3.2:3b").
func NewClient(baseURL, model string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		http:    &http.Client{Timeout: 5 * time.Minute},
	}
}

// GenerateCards sends text to Ollama and returns a list of flashcard drafts.
func (c *Client) GenerateCards(ctx context.Context, text string) ([]CardDraft, error) {
	const maxBytes = 4000
	if len(text) > maxBytes {
		// Truncate at a valid UTF-8 boundary so we never split a multi-byte rune.
		text = text[:maxBytes]
		for !utf8.ValidString(text) {
			text = text[:len(text)-1]
		}
	}
	return c.callOllama(ctx, buildPrompt(text))
}

// GenerateCardsFromTopic generates cards from a topic description (no source text).
// level is one of "beginner", "intermediate", or "advanced".
// learnerTypes is optional user context (e.g. ["university", "certifications"]).
func (c *Client) GenerateCardsFromTopic(ctx context.Context, topic string, count int, level string, learnerTypes []string) ([]CardDraft, error) {
	const maxTopicBytes = 500
	if len(topic) > maxTopicBytes {
		topic = topic[:maxTopicBytes]
		for !utf8.ValidString(topic) {
			topic = topic[:len(topic)-1]
		}
	}
	return c.callOllama(ctx, buildTopicPrompt(topic, count, level, learnerTypes))
}

func (c *Client) callOllama(ctx context.Context, prompt string) ([]CardDraft, error) {
	reqBody, err := json.Marshal(map[string]any{
		"model":  c.model,
		"prompt": prompt,
		"stream": false,
		"options": map[string]any{
			"temperature": 0.3,
			"num_ctx":     2048,
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/api/generate", bytes.NewReader(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("ollama: HTTP %d", resp.StatusCode)
	}

	var ollamaResp struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, fmt.Errorf("ollama decode: %w", err)
	}

	cards, err := parseCards(ollamaResp.Response)
	if err != nil {
		return nil, fmt.Errorf("ollama parse: %w", err)
	}
	return cards, nil
}

func buildTopicPrompt(topic string, count int, level string, learnerTypes []string) string {
	var contextLine string
	if len(learnerTypes) > 0 {
		contextLine = "\nLearner context: " + strings.Join(learnerTypes, ", ") + " — calibrate examples and framing accordingly.\n"
	}
	return fmt.Sprintf(`You are a flashcard generator. Generate exactly %d %s-level flashcard question-answer pairs for the topic below. Output ONLY the JSON array — no explanation, no markdown, no code fences, no intro text.

Topic: %s
%s
Rules:
- Exactly %d cards
- Calibrate difficulty and assumed prior knowledge to the %s level
- Each question must be specific and self-contained
- Answers: 1–3 sentences, no filler, no "According to..." openers
- Vary types: definitions, mechanisms, comparisons, examples, applications

Required output format (the entire response must be this and nothing else):
[{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}, ...]`, count, level, topic, contextLine, count, level)
}

func buildPrompt(text string) string {
	return `You are a flashcard generator. Given the following study material, generate high-quality question-and-answer flashcard pairs for studying.

Rules:
- Generate between 5 and 15 cards depending on content density
- Each question must be specific, clear, and self-contained
- Answers must be concise (1-3 sentences max) — no padding or filler phrases
- Do NOT start answers with "According to the text..." or similar
- Vary question types: definitions, mechanisms, comparisons, examples, applications
- Return ONLY a valid JSON array — no explanation, no markdown, no code fences

Required format (exactly):
[{"question": "...", "answer": "..."}, ...]

Study material:
---
` + text + `
---`
}

// parseCards extracts the JSON array from the model's response.
// The model sometimes wraps the array in extra text or markdown — we locate
// the first '[' and last ']' and parse only that slice.
func parseCards(response string) ([]CardDraft, error) {
	start := strings.Index(response, "[")
	end := strings.LastIndex(response, "]")
	if start == -1 || end == -1 || end <= start {
		return nil, fmt.Errorf("no JSON array in response")
	}

	var cards []CardDraft
	if err := json.Unmarshal([]byte(response[start:end+1]), &cards); err != nil {
		return nil, err
	}

	// Filter out any empty pairs the model might produce.
	out := cards[:0]
	for _, c := range cards {
		if strings.TrimSpace(c.Question) != "" && strings.TrimSpace(c.Answer) != "" {
			out = append(out, c)
		}
	}
	return out, nil
}
