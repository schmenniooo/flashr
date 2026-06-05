package collections

import "time"

// ComputeNewStreak returns the updated streak value and whether it changed.
// It encapsulates all streak-progression rules so they can be unit-tested
// without a database.
//
// Rules:
//   - If cardsToday < dailyGoal: no change.
//   - If streak was already extended on reviewDateStr: no change (idempotent).
//   - If yesterday's date matches streakUpdatedOn: streak increments.
//   - Otherwise (gap or first-ever): streak resets to 1.
func ComputeNewStreak(
	cardsToday, dailyGoal, streak int,
	streakUpdatedOn *time.Time,
	reviewDateStr string, // "YYYY-MM-DD", the user's local calendar date
) (newStreak int, changed bool) {
	if cardsToday < dailyGoal {
		return streak, false
	}

	alreadyToday := streakUpdatedOn != nil &&
		streakUpdatedOn.UTC().Format("2006-01-02") == reviewDateStr
	if alreadyToday {
		return streak, false
	}

	reviewDate, err := time.Parse("2006-01-02", reviewDateStr)
	if err != nil {
		return streak, false
	}
	yesterday := reviewDate.AddDate(0, 0, -1).Format("2006-01-02")

	lastUpdated := ""
	if streakUpdatedOn != nil {
		lastUpdated = streakUpdatedOn.UTC().Format("2006-01-02")
	}

	if lastUpdated == yesterday {
		return streak + 1, true
	}
	return 1, true
}
