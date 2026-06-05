// Package srs implements the SM-2 spaced-repetition algorithm.
// Cards are reviewed with a quality score; the algorithm adjusts the
// review interval and ease factor so cards reappear at the right time.
package srs

import (
	"math"
	"time"
)

// Meta holds the SM-2 scheduling state for a single card.
type Meta struct {
	Interval    int       `json:"interval"`
	EaseFactor  float64   `json:"ease_factor"`
	Repetitions int       `json:"repetitions"`
	DueDate     time.Time `json:"due_date"`
}

// RatingToQuality maps the four flashr rating labels to SM-2 quality scores.
func RatingToQuality(rating string) int {
	switch rating {
	case "again":
		return 1
	case "hard":
		return 3
	case "good":
		return 4
	case "easy":
		return 5
	default:
		return 4
	}
}

// NewMeta returns the initial SM-2 state for a card that has never been reviewed.
func NewMeta() Meta {
	return Meta{
		Interval:    1,
		EaseFactor:  2.5,
		Repetitions: 0,
		DueDate:     time.Now().UTC(),
	}
}

// Apply runs one SM-2 review and returns the updated Meta.
// quality must be in [1, 5]; values below 3 reset the repetition counter.
func Apply(m Meta, quality int) Meta {
	const minEase = 1.3

	if quality < 3 {
		// Failed recall: reset progression but keep ease factor adjustment.
		m.Repetitions = 0
		m.Interval = 1
	} else {
		switch m.Repetitions {
		case 0:
			m.Interval = 1
		case 1:
			m.Interval = 6
		default:
			m.Interval = int(math.Round(float64(m.Interval) * m.EaseFactor))
		}
		m.Repetitions++
	}

	// Adjust ease factor (SM-2 formula).
	m.EaseFactor += 0.1 - float64(5-quality)*(0.08+float64(5-quality)*0.02)
	if m.EaseFactor < minEase {
		m.EaseFactor = minEase
	}

	m.DueDate = time.Now().UTC().Add(time.Duration(m.Interval) * 24 * time.Hour)
	return m
}

// Mastery derives the three-tier mastery label from SM-2 state.
func Mastery(m *Meta) string {
	if m == nil || m.Repetitions == 0 {
		return "new"
	}
	if m.Interval < 21 {
		return "learning"
	}
	return "known"
}
