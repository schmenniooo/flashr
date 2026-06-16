//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/notifications"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

// testPushEndpoint is a valid FCM endpoint used in subscribe/unsubscribe tests.
const testPushEndpoint = "https://fcm.googleapis.com/fcm/send/test-subscription-abc123"

// notifRouter creates a dedicated Gin engine with notification routes. It uses
// ephemeral VAPID keys (no Config), which is fine for unit-level HTTP testing.
func notifRouter(t *testing.T) *gin.Engine {
	t.Helper()
	svc, err := notifications.NewService(testPool, notifications.Config{})
	require.NoError(t, err, "create notification service")
	r := gin.New()
	svc.RegisterRoutes(r.Group("/api"), testAuthSvc.RequireUser())
	return r
}

// doN fires an HTTP request against the notification router.
func doN(t *testing.T, r *gin.Engine, method, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var b *bytes.Buffer
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(t, err)
		b = bytes.NewBuffer(raw)
	} else {
		b = &bytes.Buffer{}
	}
	req := httptest.NewRequest(method, path, b)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// ── GET /api/notifications/vapid-public-key ──────────────────────────────────

func TestNotifications_VAPIDPublicKey(t *testing.T) {
	testutil.Truncate(t, testPool)
	r := notifRouter(t)

	w := doN(t, r, http.MethodGet, "/api/notifications/vapid-public-key", nil, "")

	require.Equal(t, http.StatusOK, w.Code)
	var res struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&res))
	assert.NotEmpty(t, res.Key, "VAPID public key must not be empty")
}

// ── POST /api/notifications/subscribe ────────────────────────────────────────

func TestNotifications_Subscribe_RequiresAuth(t *testing.T) {
	testutil.Truncate(t, testPool)
	r := notifRouter(t)

	w := doN(t, r, http.MethodPost, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
		"p256dh":   "BHxxxxkey",
		"auth":     "authkey",
	}, "")

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestNotifications_Subscribe_MissingFields(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-missing"))
	r := notifRouter(t)

	// Only endpoint, missing p256dh and auth
	w := doN(t, r, http.MethodPost, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
	}, token)

	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestNotifications_Subscribe_DisallowedEndpoint(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-ssrf"))
	r := notifRouter(t)

	cases := []struct {
		name     string
		endpoint string
	}{
		{"http scheme", "http://fcm.googleapis.com/fcm/send/abc"},
		{"localhost", "https://localhost/push"},
		{"internal IP", "https://10.0.0.1/push"},
		{"unknown domain", "https://evil.example.com/push"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doN(t, r, http.MethodPost, "/api/notifications/subscribe", map[string]string{
				"endpoint": tc.endpoint,
				"p256dh":   "key",
				"auth":     "auth",
			}, token)
			assert.Equal(t, http.StatusBadRequest, w.Code, "endpoint %q should be rejected", tc.endpoint)
		})
	}
}

func TestNotifications_Subscribe_Success(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-sub"))
	r := notifRouter(t)

	w := doN(t, r, http.MethodPost, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
		"p256dh":   "BHxxxxp256dhkey",
		"auth":     "authauthkey",
	}, token)

	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestNotifications_Subscribe_Idempotent(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-idem"))
	r := notifRouter(t)

	payload := map[string]string{
		"endpoint": testPushEndpoint,
		"p256dh":   "BHxxxxp256dhkey",
		"auth":     "authauthkey",
	}

	// First subscribe
	w1 := doN(t, r, http.MethodPost, "/api/notifications/subscribe", payload, token)
	require.Equal(t, http.StatusNoContent, w1.Code, "first subscribe should succeed")

	// Second subscribe with same endpoint (upsert)
	w2 := doN(t, r, http.MethodPost, "/api/notifications/subscribe", payload, token)
	require.Equal(t, http.StatusNoContent, w2.Code, "second subscribe should succeed (upsert)")
}

// ── DELETE /api/notifications/subscribe ──────────────────────────────────────

func TestNotifications_Unsubscribe_RequiresAuth(t *testing.T) {
	testutil.Truncate(t, testPool)
	r := notifRouter(t)

	w := doN(t, r, http.MethodDelete, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
	}, "")

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestNotifications_Unsubscribe_Success(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-unsub"))
	r := notifRouter(t)

	// Subscribe first
	doN(t, r, http.MethodPost, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
		"p256dh":   "BHxxxxp256dhkey",
		"auth":     "authauthkey",
	}, token)

	// Unsubscribe
	w := doN(t, r, http.MethodDelete, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
	}, token)

	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestNotifications_Unsubscribe_NonExistentEndpoint(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-unsub-missing"))
	r := notifRouter(t)

	// Unsubscribe without subscribing first — should still be 204 (no-op)
	w := doN(t, r, http.MethodDelete, "/api/notifications/subscribe", map[string]string{
		"endpoint": testPushEndpoint,
	}, token)

	require.Equal(t, http.StatusNoContent, w.Code)
}

// ── PATCH /api/auth/me — notification_time ───────────────────────────────────

func TestNotifications_PatchMe_SetTime(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-patch"))

	w := do(t, http.MethodPatch, "/api/auth/me", map[string]string{
		"notification_time": "09:00",
		"notification_tz":   "America/New_York",
	}, token)
	mustStatus(t, w, http.StatusOK)

	var res struct {
		User struct {
			NotificationTime *string `json:"notification_time"`
			NotificationTZ   *string `json:"notification_tz"`
		} `json:"user"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&res))
	require.NotNil(t, res.User.NotificationTime)
	assert.Equal(t, "09:00", *res.User.NotificationTime)
}

func TestNotifications_PatchMe_InvalidTime(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-invalid"))

	cases := []string{"25:00", "24:00", "00:60", "9:00", "0900", "abc", ""}
	for _, tc := range cases {
		t.Run(tc, func(t *testing.T) {
			w := do(t, http.MethodPatch, "/api/auth/me", map[string]string{
				"notification_time": tc,
			}, token)
			// Empty string is the opt-out sentinel — treated as clear, not invalid.
			// All other non-HH:MM values must return 400.
			if tc == "" {
				mustStatus(t, w, http.StatusOK)
			} else {
				mustStatus(t, w, http.StatusBadRequest)
			}
		})
	}
}

func TestNotifications_PatchMe_ClearTime(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-clear"))

	// Set a time first
	w := do(t, http.MethodPatch, "/api/auth/me", map[string]string{
		"notification_time": "08:00",
		"notification_tz":   "Europe/Berlin",
	}, token)
	mustStatus(t, w, http.StatusOK)

	// Clear with empty string (opt-out sentinel)
	w = do(t, http.MethodPatch, "/api/auth/me", map[string]string{
		"notification_time": "",
	}, token)
	mustStatus(t, w, http.StatusOK)

	var res struct {
		User struct {
			NotificationTime *string `json:"notification_time"`
		} `json:"user"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&res))
	assert.Nil(t, res.User.NotificationTime, "notification_time should be nil after clearing")
}

func TestNotifications_PatchMe_OmittingTimeLeavesPreviousValue(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, token := signUp(t, uniqueEmail("notif-noop"))

	// Set a time
	w := do(t, http.MethodPatch, "/api/auth/me", map[string]string{
		"notification_time": "07:30",
		"notification_tz":   "UTC",
	}, token)
	mustStatus(t, w, http.StatusOK)

	// Patch something else (daily_goal) without touching notification_time
	w = do(t, http.MethodPatch, "/api/auth/me", map[string]any{
		"daily_goal": 10,
	}, token)
	mustStatus(t, w, http.StatusOK)

	var res struct {
		User struct {
			NotificationTime *string `json:"notification_time"`
		} `json:"user"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&res))
	require.NotNil(t, res.User.NotificationTime)
	assert.Equal(t, "07:30", *res.User.NotificationTime, "notification_time should be unchanged")
}
