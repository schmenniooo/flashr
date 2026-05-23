package ai_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/ai"
)

func TestExtractNextCard(t *testing.T) {
	type result struct {
		card      *ai.CardDraft
		remaining string
		found     bool
	}
	tests := []struct {
		name string
		buf  string
		want result
	}{
		{
			name: "single complete card",
			buf:  `{"question":"What is Go?","answer":"A compiled language"}`,
			want: result{card: &ai.CardDraft{Question: "What is Go?", Answer: "A compiled language"}, remaining: "", found: true},
		},
		{
			name: "card with trailing junk",
			buf:  `{"question":"Q","answer":"A"} extra text`,
			want: result{card: &ai.CardDraft{Question: "Q", Answer: "A"}, remaining: " extra text", found: true},
		},
		{
			name: "junk before card",
			buf:  `some preamble {"question":"Q","answer":"A"}`,
			want: result{card: &ai.CardDraft{Question: "Q", Answer: "A"}, remaining: "", found: true},
		},
		{
			name: "card with escaped quotes in values",
			buf:  `{"question":"What is \"Go\"?","answer":"A language"}`,
			want: result{card: &ai.CardDraft{Question: `What is "Go"?`, Answer: "A language"}, remaining: "", found: true},
		},
		{
			name: "card with newlines in values",
			buf:  `{"question":"Q\nwith newline","answer":"A\nalso newline"}`,
			want: result{card: &ai.CardDraft{Question: "Q\nwith newline", Answer: "A\nalso newline"}, remaining: "", found: true},
		},
		{
			name: "two cards — returns only the first",
			buf:  `{"question":"Q1","answer":"A1"}{"question":"Q2","answer":"A2"}`,
			want: result{card: &ai.CardDraft{Question: "Q1", Answer: "A1"}, remaining: `{"question":"Q2","answer":"A2"}`, found: true},
		},
		{
			name: "partial card — not yet complete",
			buf:  `{"question":"Q","answer":"A"`,
			want: result{card: nil, remaining: `{"question":"Q","answer":"A"`, found: false},
		},
		{
			name: "empty buffer",
			buf:  "",
			want: result{card: nil, remaining: "", found: false},
		},
		{
			name: "no opening brace",
			buf:  "just text, no JSON here",
			want: result{card: nil, remaining: "just text, no JSON here", found: false},
		},
		{
			name: "missing answer field — found=true but card=nil",
			buf:  `{"question":"Q"}`,
			want: result{card: nil, remaining: "", found: true},
		},
		{
			name: "empty question — found=true but card=nil",
			buf:  `{"question":"","answer":"A"}`,
			want: result{card: nil, remaining: "", found: true},
		},
		{
			name: "empty answer — found=true but card=nil",
			buf:  `{"question":"Q","answer":""}`,
			want: result{card: nil, remaining: "", found: true},
		},
		{
			name: "array wrapper — skips to first object inside",
			buf:  `[{"question":"Q1","answer":"A1"},{"question":"Q2","answer":"A2"}]`,
			want: result{card: &ai.CardDraft{Question: "Q1", Answer: "A1"}, remaining: `,{"question":"Q2","answer":"A2"}]`, found: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			card, remaining, found := ai.ExtractNextCard(tt.buf)
			assert.Equal(t, tt.want.found, found, "found mismatch")
			assert.Equal(t, tt.want.remaining, remaining, "remaining mismatch")
			if tt.want.card == nil {
				assert.Nil(t, card)
			} else {
				require.NotNil(t, card)
				assert.Equal(t, tt.want.card.Question, card.Question)
				assert.Equal(t, tt.want.card.Answer, card.Answer)
			}
		})
	}
}
