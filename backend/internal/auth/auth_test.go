package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidNotificationTime(t *testing.T) {
	cases := []struct {
		name string
		s    string
		want bool
	}{
		// Valid times
		{"midnight", "00:00", true},
		{"morning", "08:00", true},
		{"noon", "12:30", true},
		{"last valid minute", "23:59", true},

		// Invalid hours
		{"hour 24", "24:00", false},
		{"hour 25", "25:00", false},

		// Invalid minutes
		{"minute 60", "00:60", false},
		{"minute 99", "12:99", false},

		// Wrong format
		{"too short", "8:00", false},
		{"too long", "008:00", false},
		{"no colon", "0800", false},
		{"wrong separator", "08-00", false},
		{"empty", "", false},
		{"letters", "AB:CD", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, validNotificationTime(tc.s))
		})
	}
}
