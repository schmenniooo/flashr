//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/test/testutil"
)

// reviewWithDate calls the review endpoint sending an explicit local date.
func reviewWithDate(t *testing.T, cardID, rating, date, tok string) *struct {
	CardsToday int  `json:"cards_today"`
	DailyGoal  int  `json:"daily_goal"`
	Streak     int  `json:"streak"`
	GoalMet    bool `json:"goal_met"`
} {
	t.Helper()
	body := map[string]string{"rating": rating, "date": date}
	w := do(t, http.MethodPost, "/api/cards/"+cardID+"/review", body, tok)
	mustStatus(t, w, http.StatusOK)
	var out struct {
		CardsToday int  `json:"cards_today"`
		DailyGoal  int  `json:"daily_goal"`
		Streak     int  `json:"streak"`
		GoalMet    bool `json:"goal_met"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&out))
	return &out
}

// setDailyGoal patches the user's daily_goal via PATCH /auth/me.
func setDailyGoal(t *testing.T, goal int, tok string) {
	t.Helper()
	w := do(t, http.MethodPatch, "/api/auth/me", map[string]int{"daily_goal": goal}, tok)
	mustStatus(t, w, http.StatusOK)
}

func TestStreak_GoalMetFirstTime(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_first"))
	_, cardID := createCollectionWithCard(t, tok)

	setDailyGoal(t, 1, tok) // goal = 1 card

	res := reviewWithDate(t, cardID, "good", "2026-06-05", tok)
	assert.Equal(t, 1, res.CardsToday)
	assert.Equal(t, 1, res.DailyGoal)
	assert.True(t, res.GoalMet)
	assert.Equal(t, 1, res.Streak)
}

func TestStreak_BelowGoalNoChange(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_below"))
	_, cardID := createCollectionWithCard(t, tok)

	setDailyGoal(t, 5, tok) // goal = 5 cards

	res := reviewWithDate(t, cardID, "good", "2026-06-05", tok)
	assert.Equal(t, 1, res.CardsToday)
	assert.False(t, res.GoalMet)
	assert.Equal(t, 0, res.Streak)
}

func TestStreak_ConsecutiveDays(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_consec"))
	_, cardID := createCollectionWithCard(t, tok)

	setDailyGoal(t, 1, tok)

	// Day 1
	res1 := reviewWithDate(t, cardID, "good", "2026-06-04", tok)
	assert.Equal(t, 1, res1.Streak)

	// Day 2
	res2 := reviewWithDate(t, cardID, "good", "2026-06-05", tok)
	assert.Equal(t, 2, res2.Streak)
}

func TestStreak_GapResetsToOne(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_gap"))
	_, cardID := createCollectionWithCard(t, tok)

	setDailyGoal(t, 1, tok)

	// Day 1
	reviewWithDate(t, cardID, "good", "2026-06-01", tok)

	// Day 4 (gap of 2 days)
	res := reviewWithDate(t, cardID, "good", "2026-06-04", tok)
	assert.Equal(t, 1, res.Streak, "streak should reset to 1 after a gap")
}

func TestStreak_IdempotentSameDay(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_idem"))
	_, cardID := createCollectionWithCard(t, tok)

	setDailyGoal(t, 1, tok)

	// Hit goal on same day twice — streak should only go to 1.
	reviewWithDate(t, cardID, "good", "2026-06-05", tok)
	res := reviewWithDate(t, cardID, "good", "2026-06-05", tok)
	assert.Equal(t, 1, res.Streak, "streak should not double-increment within the same day")
}

func TestStreak_PatchDailyGoalPersists(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("streak_goal_patch"))

	setDailyGoal(t, 42, tok)

	w := do(t, http.MethodGet, "/api/auth/me", nil, tok)
	mustStatus(t, w, http.StatusOK)
	var res struct {
		User struct {
			DailyGoal int `json:"daily_goal"`
		} `json:"user"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&res))
	assert.Equal(t, 42, res.User.DailyGoal)
}
