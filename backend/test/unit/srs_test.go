package unit

import (
	"testing"
	"time"

	"github.com/smithlabs/flashr/backend/internal/srs"
	"github.com/stretchr/testify/assert"
)

// ── Apply ─────────────────────────────────────────────────────────────────────

func TestApply_Again(t *testing.T) {
	m := srs.Meta{Interval: 6, EaseFactor: 2.5, Repetitions: 2, DueDate: time.Now()}
	got := srs.Apply(m, srs.RatingToQuality("again"))
	assert.Equal(t, 1, got.Interval, "interval resets to 1 on Again")
	assert.Equal(t, 0, got.Repetitions, "repetitions reset to 0 on Again")
	assert.GreaterOrEqual(t, got.EaseFactor, 1.3, "ease factor stays >= 1.3")
}

func TestApply_Hard(t *testing.T) {
	m := srs.Meta{Interval: 6, EaseFactor: 2.5, Repetitions: 2, DueDate: time.Now()}
	got := srs.Apply(m, srs.RatingToQuality("hard"))
	assert.Greater(t, got.Interval, 0, "interval must be positive after Hard")
	assert.Less(t, got.EaseFactor, 2.5, "ease factor decreases after Hard")
	assert.GreaterOrEqual(t, got.EaseFactor, 1.3, "ease factor stays >= 1.3")
	assert.Equal(t, 3, got.Repetitions, "repetitions increment after Hard")
}

func TestApply_Good_Progression(t *testing.T) {
	m := srs.NewMeta()
	// rep 0 → interval should become 1
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.Equal(t, 1, m.Interval)
	assert.Equal(t, 1, m.Repetitions)

	// rep 1 → interval should jump to 6
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.Equal(t, 6, m.Interval)
	assert.Equal(t, 2, m.Repetitions)

	// rep 2+ → interval multiplied by ease factor
	prev := m.Interval
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.Greater(t, m.Interval, prev, "interval grows on successive Good ratings")
}

func TestApply_Easy(t *testing.T) {
	m := srs.NewMeta()
	m = srs.Apply(m, srs.RatingToQuality("easy"))
	m = srs.Apply(m, srs.RatingToQuality("easy"))
	prev := m.Interval
	m = srs.Apply(m, srs.RatingToQuality("easy"))
	assert.Greater(t, m.Interval, prev, "interval grows faster on Easy")
	assert.Greater(t, m.EaseFactor, 2.5, "ease factor increases after Easy")
}

func TestApply_EaseFloor(t *testing.T) {
	// Repeatedly rate Again to drive ease factor down to the floor.
	m := srs.NewMeta()
	for i := 0; i < 20; i++ {
		m = srs.Apply(m, srs.RatingToQuality("again"))
	}
	assert.Equal(t, 1.3, m.EaseFactor, "ease factor must not drop below 1.3")
}

func TestApply_DueDateAdvances(t *testing.T) {
	before := time.Now()
	m := srs.NewMeta()
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.True(t, m.DueDate.After(before), "due date must be in the future after review")
}

func TestApply_AgainThenGood(t *testing.T) {
	// Reset after Again, then recover.
	m := srs.NewMeta()
	m = srs.Apply(m, srs.RatingToQuality("good"))
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.Equal(t, 6, m.Interval)

	m = srs.Apply(m, srs.RatingToQuality("again"))
	assert.Equal(t, 1, m.Interval)
	assert.Equal(t, 0, m.Repetitions)

	// Restart progression from scratch.
	m = srs.Apply(m, srs.RatingToQuality("good"))
	assert.Equal(t, 1, m.Interval)
	assert.Equal(t, 1, m.Repetitions)
}

// ── Mastery ───────────────────────────────────────────────────────────────────

func TestMastery_Nil(t *testing.T) {
	assert.Equal(t, "new", srs.Mastery(nil))
}

func TestMastery_New(t *testing.T) {
	m := srs.NewMeta() // repetitions = 0
	assert.Equal(t, "new", srs.Mastery(&m))
}

func TestMastery_Learning(t *testing.T) {
	m := srs.Meta{Interval: 10, Repetitions: 2}
	assert.Equal(t, "learning", srs.Mastery(&m))
}

func TestMastery_Known(t *testing.T) {
	m := srs.Meta{Interval: 21, Repetitions: 5}
	assert.Equal(t, "known", srs.Mastery(&m))
}

func TestMastery_KnownBoundary(t *testing.T) {
	m := srs.Meta{Interval: 20, Repetitions: 5}
	assert.Equal(t, "learning", srs.Mastery(&m), "interval=20 is still learning")

	m.Interval = 21
	assert.Equal(t, "known", srs.Mastery(&m), "interval=21 is known")
}

// ── RatingToQuality ───────────────────────────────────────────────────────────

func TestRatingToQuality(t *testing.T) {
	assert.Equal(t, 1, srs.RatingToQuality("again"))
	assert.Equal(t, 3, srs.RatingToQuality("hard"))
	assert.Equal(t, 4, srs.RatingToQuality("good"))
	assert.Equal(t, 5, srs.RatingToQuality("easy"))
	assert.Equal(t, 4, srs.RatingToQuality("unknown"), "unknown defaults to Good quality")
}
