// Package ai provides the Ollama client and flashcard generation logic.
package ai

import (
	"bufio"
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

// GenerateCards sends text to Ollama and returns flashcard drafts and whether
// the input was truncated to fit the model context window.
func (c *Client) GenerateCards(ctx context.Context, text string) ([]CardDraft, bool, error) {
	const maxBytes = 12000
	truncated := false
	if len(text) > maxBytes {
		text = text[:maxBytes]
		for !utf8.ValidString(text) {
			text = text[:len(text)-1]
		}
		truncated = true
	}
	cards, err := c.callOllama(ctx, buildPrompt(text))
	return cards, truncated, err
}

// GenerateCardsFromTopic generates cards from a topic description (no source text).
// level is one of "beginner", "intermediate", or "advanced".
// learnerTypes is optional user context (e.g. ["university", "certifications"]).
// existingCards is the current deck — the AI will avoid duplicating them.
func (c *Client) GenerateCardsFromTopic(ctx context.Context, topic string, count int, level string, learnerTypes []string, existingCards []CardDraft) ([]CardDraft, error) {
	const maxTopicBytes = 1000
	if len(topic) > maxTopicBytes {
		topic = topic[:maxTopicBytes]
		for !utf8.ValidString(topic) {
			topic = topic[:len(topic)-1]
		}
	}
	return c.callOllama(ctx, buildTopicPrompt(topic, count, level, learnerTypes, existingCards))
}

// GenerateCardsFromTopicStream is the streaming variant of GenerateCardsFromTopic.
// It calls Ollama with stream:true and invokes onCard each time a complete
// question/answer pair is parsed out of the token stream.
// existingCards is the current deck — the AI will avoid duplicating them.
func (c *Client) GenerateCardsFromTopicStream(ctx context.Context, topic string, count int, level string, learnerTypes []string, existingCards []CardDraft, onCard func(CardDraft)) error {
	const maxTopicBytes = 1000
	if len(topic) > maxTopicBytes {
		topic = topic[:maxTopicBytes]
		for !utf8.ValidString(topic) {
			topic = topic[:len(topic)-1]
		}
	}
	return c.callOllamaStream(ctx, buildTopicPrompt(topic, count, level, learnerTypes, existingCards), onCard)
}

func (c *Client) callOllamaStream(ctx context.Context, prompt string, onCard func(CardDraft)) error {
	reqBody, err := json.Marshal(map[string]any{
		"model":  c.model,
		"prompt": prompt,
		"stream": true,
		"options": map[string]any{
			"temperature": 0.3,
			"num_ctx":     5120,
		},
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/api/generate", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("ollama: HTTP %d", resp.StatusCode)
	}

	var buf string
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		var chunk struct {
			Response string `json:"response"`
			Done     bool   `json:"done"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
			continue
		}
		buf += chunk.Response

		// Extract any complete card objects from the accumulated buffer.
		for {
			card, remaining, found := extractNextCard(buf)
			if !found {
				break
			}
			buf = remaining
			if card != nil {
				onCard(*card)
			}
		}

		if chunk.Done {
			break
		}
	}
	return scanner.Err()
}

// extractNextCard finds the first complete JSON object in buf using bracket
// matching. Returns the parsed card (nil if malformed), the remaining string
// after the closing brace, and found=true when a complete object was located.
func extractNextCard(buf string) (card *CardDraft, remaining string, found bool) {
	start := strings.Index(buf, "{")
	if start == -1 {
		return nil, buf, false
	}

	depth := 0
	inString := false
	escape := false

	for i := start; i < len(buf); i++ {
		ch := buf[i]
		if escape {
			escape = false
			continue
		}
		if ch == '\\' && inString {
			escape = true
			continue
		}
		if ch == '"' {
			inString = !inString
			continue
		}
		if inString {
			continue
		}
		switch ch {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				var c CardDraft
				if err := json.Unmarshal([]byte(buf[start:i+1]), &c); err == nil &&
					strings.TrimSpace(c.Question) != "" && strings.TrimSpace(c.Answer) != "" {
					return &c, buf[i+1:], true
				}
				return nil, buf[i+1:], true
			}
		}
	}
	return nil, buf, false
}

func (c *Client) callOllama(ctx context.Context, prompt string) ([]CardDraft, error) {
	reqBody, err := json.Marshal(map[string]any{
		"model":  c.model,
		"prompt": prompt,
		"stream": false,
		"options": map[string]any{
			"temperature": 0.3,
			"num_ctx":     5120,
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

func buildTopicPrompt(topic string, count int, level string, learnerTypes []string, existingCards []CardDraft) string {
	var contextLine string
	if len(learnerTypes) > 0 {
		contextLine = "\nLearner context: " + strings.Join(learnerTypes, ", ") + " — calibrate examples and framing accordingly.\n"
	}

	var existingSection string
	if len(existingCards) > 0 {
		const maxExisting = 60
		cards := existingCards
		if len(cards) > maxExisting {
			cards = cards[:maxExisting]
		}
		var sb strings.Builder
		sb.WriteString("\nThe collection already contains these cards — do NOT duplicate or rephrase any of them:\n")
		for i, c := range cards {
			q := strings.ReplaceAll(c.Question, "\n", " ")
			a := strings.ReplaceAll(c.Answer, "\n", " ")
			fmt.Fprintf(&sb, "%d. Q: %s | A: %s\n", i+1, q, a)
		}
		existingSection = sb.String()
	}

	return fmt.Sprintf(`You are a flashcard generator. Generate exactly %d %s-level flashcard question-answer pairs for the topic below. Output ONLY the JSON array — no explanation, no markdown, no code fences, no intro text.

Topic: %s
%s%s
Rules:
- Exactly %d cards
- Calibrate difficulty and assumed prior knowledge to the %s level
- Each question must be specific and self-contained
- Answers: 1–3 sentences, no filler, no "According to..." openers
- Vary types: definitions, mechanisms, comparisons, examples, applications

Required output format (the entire response must be this and nothing else):
[{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}, ...]`, count, level, topic, contextLine, existingSection, count, level)
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
