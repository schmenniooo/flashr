package unit

import (
	"testing"
	"time"

	"github.com/smithlabs/flashr/backend/internal/collections"
)

func ptr(t time.Time) *time.Time { return &t }

func date(s string) time.Time {
	d, _ := time.Parse("2006-01-02", s)
	return d
}

func TestComputeNewStreak_BelowGoal(t *testing.T) {
	newStreak, changed := collections.ComputeNewStreak(3, 10, 5, nil, "2026-06-05")
	if changed {
		t.Fatal("streak should not change when below daily goal")
	}
	if newStreak != 5 {
		t.Fatalf("expected 5, got %d", newStreak)
	}
}

func TestComputeNewStreak_ExactlyGoal(t *testing.T) {
	newStreak, changed := collections.ComputeNewStreak(10, 10, 0, nil, "2026-06-05")
	if !changed {
		t.Fatal("streak should change when cards_today == daily_goal")
	}
	if newStreak != 1 {
		t.Fatalf("expected 1 (first-ever), got %d", newStreak)
	}
}

func TestComputeNewStreak_AlreadyUpdatedToday(t *testing.T) {
	updatedOn := ptr(date("2026-06-05"))
	newStreak, changed := collections.ComputeNewStreak(10, 10, 3, updatedOn, "2026-06-05")
	if changed {
		t.Fatal("streak should not change if already updated today")
	}
	if newStreak != 3 {
		t.Fatalf("expected 3, got %d", newStreak)
	}
}

func TestComputeNewStreak_ConsecutiveDay(t *testing.T) {
	updatedOn := ptr(date("2026-06-04"))
	newStreak, changed := collections.ComputeNewStreak(10, 10, 4, updatedOn, "2026-06-05")
	if !changed {
		t.Fatal("streak should increment on consecutive day")
	}
	if newStreak != 5 {
		t.Fatalf("expected 5, got %d", newStreak)
	}
}

func TestComputeNewStreak_GapResetsToOne(t *testing.T) {
	updatedOn := ptr(date("2026-06-02")) // two days ago — streak broken
	newStreak, changed := collections.ComputeNewStreak(10, 10, 7, updatedOn, "2026-06-05")
	if !changed {
		t.Fatal("streak should change after a gap")
	}
	if newStreak != 1 {
		t.Fatalf("expected 1 (reset), got %d", newStreak)
	}
}

func TestComputeNewStreak_FirstEver(t *testing.T) {
	// No prior streak_updated_on at all.
	newStreak, changed := collections.ComputeNewStreak(20, 20, 0, nil, "2026-06-05")
	if !changed {
		t.Fatal("streak should change on first goal-meeting day")
	}
	if newStreak != 1 {
		t.Fatalf("expected 1, got %d", newStreak)
	}
}

func TestComputeNewStreak_AboveGoal(t *testing.T) {
	// Over-achieving (more cards than goal) still counts.
	updatedOn := ptr(date("2026-06-04"))
	newStreak, changed := collections.ComputeNewStreak(35, 20, 2, updatedOn, "2026-06-05")
	if !changed {
		t.Fatal("streak should change when over goal")
	}
	if newStreak != 3 {
		t.Fatalf("expected 3, got %d", newStreak)
	}
}
