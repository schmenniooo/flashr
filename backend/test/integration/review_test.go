//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

func createCollectionWithCard(t *testing.T, tok string) (colID, cardID string) {
	t.Helper()
	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "SRS Test"}, tok)
	mustStatus(t, wCol, http.StatusCreated)
	var col collections.Collection
	decode(t, wCol, &col)

	wCard := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "What is SM-2?", "answer": "A spaced-repetition algorithm",
	}, tok)
	mustStatus(t, wCard, http.StatusCreated)
	var card collections.Card
	decode(t, wCard, &card)

	return col.ID, card.ID
}

func TestReview_FirstReview_Good(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_first"))
	_, cardID := createCollectionWithCard(t, tok)

	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)
	mustStatus(t, w, http.StatusOK)

	var card collections.Card
	decode(t, w, &card)
	assert.Equal(t, 1, card.Interval, "first Good review sets interval to 1")
	assert.Equal(t, 1, card.Repetitions)
	assert.Equal(t, "learning", card.Mastery)
	assert.NotNil(t, card.DueDate)
}

func TestReview_Progression(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_progress"))
	_, cardID := createCollectionWithCard(t, tok)

	// Review 1: Good → interval=1
	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)
	mustStatus(t, w, http.StatusOK)
	var c1 collections.Card
	decode(t, w, &c1)
	assert.Equal(t, 1, c1.Interval)

	// Review 2: Good → interval=6
	w = do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)
	mustStatus(t, w, http.StatusOK)
	var c2 collections.Card
	decode(t, w, &c2)
	assert.Equal(t, 6, c2.Interval)

	// Review 3: Good → interval > 6
	w = do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)
	mustStatus(t, w, http.StatusOK)
	var c3 collections.Card
	decode(t, w, &c3)
	assert.Greater(t, c3.Interval, 6, "interval must grow beyond 6 after third Good")
}

func TestReview_Reset_After_Again(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_reset"))
	_, cardID := createCollectionWithCard(t, tok)

	// Advance to interval=6.
	do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)
	do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)

	// Rate Again — interval must reset.
	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "again"}, tok)
	mustStatus(t, w, http.StatusOK)
	var card collections.Card
	decode(t, w, &card)
	assert.Equal(t, 1, card.Interval, "Again resets interval to 1")
	assert.Equal(t, 0, card.Repetitions, "Again resets repetitions to 0")
}

func TestReview_Unauthorized(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok1 := signUp(t, uniqueEmail("review_owner"))
	_, tok2 := signUp(t, uniqueEmail("review_intruder"))
	_, cardID := createCollectionWithCard(t, tok1)

	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok2)
	mustStatus(t, w, http.StatusNotFound)
}

func TestReview_MissingRating(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_no_rating"))
	_, cardID := createCollectionWithCard(t, tok)

	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{}, tok)
	mustStatus(t, w, http.StatusBadRequest)
}

func TestReview_CardNotFound(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_notfound"))

	w := do(t, http.MethodPost, "/api/cards/00000000-0000-0000-0000-000000000000/review",
		map[string]string{"rating": "good"}, tok)
	mustStatus(t, w, http.StatusNotFound)
}

func TestReview_SRSFieldsReturnedOnList(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("review_list_fields"))
	colID, cardID := createCollectionWithCard(t, tok)

	// Review the card so srs_metadata is populated.
	do(t, http.MethodPost, "/api/cards/"+cardID+"/review", map[string]string{"rating": "good"}, tok)

	// Fetch the collection and verify SRS fields come back.
	w := do(t, http.MethodGet, "/api/collections/"+colID, nil, tok)
	mustStatus(t, w, http.StatusOK)
	var col collections.Collection
	decode(t, w, &col)
	require.Len(t, col.Cards, 1)
	assert.Equal(t, 1, col.Cards[0].Interval)
	assert.Equal(t, "learning", col.Cards[0].Mastery)
	assert.NotNil(t, col.Cards[0].DueDate)
}
