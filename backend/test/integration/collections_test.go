//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

func TestCollections_ListEmpty(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("list_empty"))

	w := do(t, http.MethodGet, "/api/collections", nil, tok)
	mustStatus(t, w, http.StatusOK)

	var resp struct {
		Collections []collections.Collection `json:"collections"`
	}
	decode(t, w, &resp)
	assert.Empty(t, resp.Collections)
}

func TestCollections_Create(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("create"))

	w := do(t, http.MethodPost, "/api/collections", map[string]string{
		"name": "Biology", "emoji": "🧬", "description": "Cell biology notes",
	}, tok)
	mustStatus(t, w, http.StatusCreated)

	var col collections.Collection
	decode(t, w, &col)
	assert.Equal(t, "Biology", col.Name)
	assert.Equal(t, "🧬", col.Emoji)
	assert.Equal(t, "Cell biology notes", col.Description)
	assert.NotEmpty(t, col.ID)
	assert.Empty(t, col.Cards)
}

func TestCollections_Create_DefaultEmoji(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("default_emoji"))

	w := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Math"}, tok)
	mustStatus(t, w, http.StatusCreated)

	var col collections.Collection
	decode(t, w, &col)
	assert.Equal(t, "📚", col.Emoji)
}

func TestCollections_Create_RequiresAuth(t *testing.T) {
	w := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Test"}, "")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestCollections_Get(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("get"))

	wCreate := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Physics"}, tok)
	mustStatus(t, wCreate, http.StatusCreated)
	var created collections.Collection
	decode(t, wCreate, &created)

	w := do(t, http.MethodGet, "/api/collections/"+created.ID, nil, tok)
	mustStatus(t, w, http.StatusOK)

	var fetched collections.Collection
	decode(t, w, &fetched)
	assert.Equal(t, created.ID, fetched.ID)
	assert.Equal(t, "Physics", fetched.Name)
}

func TestCollections_Get_NotFound(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("get_notfound"))

	w := do(t, http.MethodGet, "/api/collections/00000000-0000-0000-0000-000000000000", nil, tok)
	mustStatus(t, w, http.StatusNotFound)
}

func TestCollections_Get_OtherUserCollection(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok1 := signUp(t, uniqueEmail("owner"))
	_, tok2 := signUp(t, uniqueEmail("intruder"))

	wCreate := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Private"}, tok1)
	var col collections.Collection
	decode(t, wCreate, &col)

	w := do(t, http.MethodGet, "/api/collections/"+col.ID, nil, tok2)
	mustStatus(t, w, http.StatusNotFound)
}

func TestCollections_Update(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("update"))

	wCreate := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "History"}, tok)
	var col collections.Collection
	decode(t, wCreate, &col)

	newName := "World History"
	w := do(t, http.MethodPatch, "/api/collections/"+col.ID, map[string]string{"name": newName}, tok)
	mustStatus(t, w, http.StatusOK)

	var updated collections.Collection
	decode(t, w, &updated)
	assert.Equal(t, newName, updated.Name)
}

func TestCollections_Delete(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("delete"))

	wCreate := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Temp"}, tok)
	var col collections.Collection
	decode(t, wCreate, &col)

	w := do(t, http.MethodDelete, "/api/collections/"+col.ID, nil, tok)
	mustStatus(t, w, http.StatusNoContent)

	wGet := do(t, http.MethodGet, "/api/collections/"+col.ID, nil, tok)
	mustStatus(t, wGet, http.StatusNotFound)
}

func TestCollections_ListShowsCards(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("list_cards"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Go"}, tok)
	var col collections.Collection
	decode(t, wCol, &col)

	do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "What is a goroutine?", "answer": "A lightweight thread",
	}, tok)

	w := do(t, http.MethodGet, "/api/collections", nil, tok)
	var resp struct {
		Collections []json.RawMessage `json:"collections"`
	}
	decode(t, w, &resp)
	require.Len(t, resp.Collections, 1)
}

func TestCards_Create(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("card_create"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Go"}, tok)
	var col collections.Collection
	decode(t, wCol, &col)

	w := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "What is a goroutine?", "answer": "A lightweight thread",
	}, tok)
	mustStatus(t, w, http.StatusCreated)

	var card collections.Card
	decode(t, w, &card)
	assert.Equal(t, "What is a goroutine?", card.Question)
	assert.Equal(t, "A lightweight thread", card.Answer)
	assert.NotEmpty(t, card.ID)
}

func TestCards_Create_WrongCollection(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok1 := signUp(t, uniqueEmail("card_owner"))
	_, tok2 := signUp(t, uniqueEmail("card_intruder"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Private"}, tok1)
	var col collections.Collection
	decode(t, wCol, &col)

	w := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "Q", "answer": "A",
	}, tok2)
	mustStatus(t, w, http.StatusNotFound)
}

func TestCards_Update(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("card_update"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Go"}, tok)
	var col collections.Collection
	decode(t, wCol, &col)

	wCard := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "Old Q", "answer": "Old A",
	}, tok)
	var card collections.Card
	decode(t, wCard, &card)

	newQ := "New Q"
	w := do(t, http.MethodPatch, "/api/cards/"+card.ID, map[string]*string{"question": &newQ}, tok)
	mustStatus(t, w, http.StatusOK)

	var updated collections.Card
	decode(t, w, &updated)
	assert.Equal(t, "New Q", updated.Question)
	assert.Equal(t, "Old A", updated.Answer)
}

func TestCards_Delete(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("card_delete"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Go"}, tok)
	var col collections.Collection
	decode(t, wCol, &col)

	wCard := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "Q", "answer": "A",
	}, tok)
	var card collections.Card
	decode(t, wCard, &card)

	w := do(t, http.MethodDelete, fmt.Sprintf("/api/cards/%s", card.ID), nil, tok)
	mustStatus(t, w, http.StatusNoContent)
}

func TestCards_Delete_OtherUserCard(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok1 := signUp(t, uniqueEmail("card_del_owner"))
	_, tok2 := signUp(t, uniqueEmail("card_del_intruder"))

	wCol := do(t, http.MethodPost, "/api/collections", map[string]string{"name": "Private"}, tok1)
	var col collections.Collection
	decode(t, wCol, &col)

	wCard := do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards", map[string]string{
		"question": "Q", "answer": "A",
	}, tok1)
	var card collections.Card
	decode(t, wCard, &card)

	w := do(t, http.MethodDelete, fmt.Sprintf("/api/cards/%s", card.ID), nil, tok2)
	mustStatus(t, w, http.StatusNotFound)
}
