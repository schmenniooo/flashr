package notifications

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAllowedPushHost(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want bool
	}{
		// Known browser push services
		{"chrome / FCM", "https://fcm.googleapis.com/fcm/send/abc123", true},
		{"safari", "https://web.push.apple.com/push/1", true},
		{"firefox subdomain", "https://updates.push.services.mozilla.com/wpush/abc", true},
		{"windows push", "https://db5p.notify.windows.com/something", true},
		{"pushpad", "https://app.pushpad.xyz/send", true},
		{"onesignal subdomain", "https://push.onesignal.com/api/v1/notifications", true},

		// Scheme violations
		{"http not https", "http://fcm.googleapis.com/fcm/send/abc", false},
		{"no scheme", "fcm.googleapis.com/send", false},
		{"empty string", "", false},

		// Internal / disallowed hosts
		{"localhost", "https://localhost/push", false},
		{"loopback IP", "https://127.0.0.1/push", false},
		{"private IP", "https://10.0.0.1/push", false},
		{"AWS metadata", "https://169.254.169.254/latest/meta-data/", false},
		{"arbitrary domain", "https://evil.example.com/push", false},

		// Tricky near-matches
		{"suffix but not subdomain", "https://notfcm.googleapis.com/send", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, allowedPushHost(tc.raw))
		})
	}
}
