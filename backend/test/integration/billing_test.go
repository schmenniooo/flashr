//go:build integration

package integration

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/billing"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

const testWebhookSecret = "test-webhook-secret-32-bytes-long!"

// billingRouter builds a test router with the webhook endpoint registered.
// Checkout and portal routes are included but not exercised here — they would
// require real Stripe API credentials.
func billingRouter() *gin.Engine {
	svc := billing.NewService(testPool, billing.Config{
		SecretKey:     "sk_test_fake",
		WebhookSecret: testWebhookSecret,
		ProPriceID:    "price_test",
		FrontendURL:   "http://localhost:5173",
	})
	r := gin.New()
	svc.RegisterRoutes(r.Group("/api"), testAuthSvc.RequireUser())
	return r
}

// stripeHeader builds a valid Stripe-Signature header for the given payload.
func stripeHeader(payload []byte) string {
	ts := time.Now().Unix()
	msg := fmt.Sprintf("%d.%s", ts, payload)
	mac := hmac.New(sha256.New, []byte(testWebhookSecret))
	mac.Write([]byte(msg))
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

// webhook fires a POST to /api/billing/webhook with a signed Stripe event body.
func webhook(t *testing.T, eventType string, object map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(map[string]any{
		"id":          "evt_test_" + eventType,
		"type":        eventType,
		"api_version": "2025-06-30.basil",
		"data":        map[string]any{"object": object},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/billing/webhook", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Stripe-Signature", stripeHeader(payload))
	w := httptest.NewRecorder()
	billingRouter().ServeHTTP(w, req)
	return w
}

// planRow reads plan, stripe_subscription_id, and plan_expires_at for a user.
func planRow(t *testing.T, userID string) (plan string, subID *string, expiresAt *time.Time) {
	t.Helper()
	err := testPool.QueryRow(context.Background(),
		`SELECT plan, stripe_subscription_id, plan_expires_at FROM users WHERE id = $1`, userID,
	).Scan(&plan, &subID, &expiresAt)
	require.NoError(t, err)
	return
}

// setStripeIDs sets stripe_customer_id and stripe_subscription_id on a user row.
func setStripeIDs(t *testing.T, userID, customerID, subID string) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3`,
		customerID, subID, userID,
	)
	require.NoError(t, err)
}

// setPlan upgrades a user directly in the DB without going through Stripe.
func setPlan(t *testing.T, userID, plan string) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`UPDATE users SET plan = $1 WHERE id = $2`, plan, userID)
	require.NoError(t, err)
}

// ── Signature validation ──────────────────────────────────────────────────────

func TestWebhook_InvalidSignature_Returns400(t *testing.T) {
	payload := []byte(`{"type":"checkout.session.completed","data":{"object":{}}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/webhook", bytes.NewReader(payload))
	req.Header.Set("Stripe-Signature", "t=99999,v1=badbadbadbad")
	w := httptest.NewRecorder()
	billingRouter().ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWebhook_MissingSignature_Returns400(t *testing.T) {
	payload := []byte(`{"type":"checkout.session.completed","data":{"object":{}}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/billing/webhook", bytes.NewReader(payload))
	w := httptest.NewRecorder()
	billingRouter().ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// ── checkout.session.completed ───────────────────────────────────────────────

func TestWebhook_CheckoutCompleted_SetsPlanToPro(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("checkout_pro"))
	setStripeIDs(t, userID, "cus_001", "")

	w := webhook(t, "checkout.session.completed", map[string]any{
		"customer":     "cus_001",
		"subscription": map[string]any{"id": "sub_001"},
		"status":       "complete",
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, subID, _ := planRow(t, userID)
	assert.Equal(t, "pro", plan)
	require.NotNil(t, subID)
	assert.Equal(t, "sub_001", *subID)
}

func TestWebhook_CheckoutCompleted_NoSubscription_Ignored(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("checkout_nosub"))
	setStripeIDs(t, userID, "cus_002", "")

	// One-time payment — no subscription field, should be a no-op.
	w := webhook(t, "checkout.session.completed", map[string]any{
		"customer": "cus_002",
		"status":   "complete",
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, _ := planRow(t, userID)
	assert.Equal(t, "free", plan)
}

// ── customer.subscription.updated ────────────────────────────────────────────

func TestWebhook_SubscriptionUpdated_Active_KeepsPro(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_updated_active"))
	setStripeIDs(t, userID, "cus_003", "sub_003")
	setPlan(t, userID, "pro")

	w := webhook(t, "customer.subscription.updated", map[string]any{
		"id":                   "sub_003",
		"customer":             "cus_003",
		"status":               "active",
		"cancel_at_period_end": false,
		"current_period_end":   time.Now().Add(30 * 24 * time.Hour).Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, expiresAt := planRow(t, userID)
	assert.Equal(t, "pro", plan)
	assert.Nil(t, expiresAt, "active subscription must not set plan_expires_at")
}

func TestWebhook_SubscriptionUpdated_CancelAtPeriodEnd_SetsExpiry(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_cancel_period"))
	setStripeIDs(t, userID, "cus_004", "sub_004")
	setPlan(t, userID, "pro")

	periodEnd := time.Now().Add(30 * 24 * time.Hour)
	w := webhook(t, "customer.subscription.updated", map[string]any{
		"id":                   "sub_004",
		"customer":             "cus_004",
		"status":               "active",
		"cancel_at_period_end": true,
		"current_period_end":   periodEnd.Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, expiresAt := planRow(t, userID)
	assert.Equal(t, "pro", plan, "still pro until period ends")
	require.NotNil(t, expiresAt, "plan_expires_at must be set when cancel_at_period_end is true")
	assert.WithinDuration(t, periodEnd, *expiresAt, time.Minute)
}

func TestWebhook_SubscriptionUpdated_PastDue_DowngradesToFree(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_past_due"))
	setStripeIDs(t, userID, "cus_005", "sub_005")
	setPlan(t, userID, "pro")

	w := webhook(t, "customer.subscription.updated", map[string]any{
		"id":                 "sub_005",
		"customer":           "cus_005",
		"status":             "past_due",
		"current_period_end": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, _ := planRow(t, userID)
	assert.Equal(t, "free", plan)
}

func TestWebhook_SubscriptionUpdated_WrongSubID_NoChange(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_wrong_id"))
	setStripeIDs(t, userID, "cus_006", "sub_006_real")
	setPlan(t, userID, "pro")

	// Event is for a different subscription — must not touch this user.
	w := webhook(t, "customer.subscription.updated", map[string]any{
		"id":                 "sub_006_other",
		"customer":           "cus_006",
		"status":             "canceled",
		"current_period_end": time.Now().Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, _ := planRow(t, userID)
	assert.Equal(t, "pro", plan, "unrelated subscription event must not affect the user's plan")
}

// ── customer.subscription.deleted ────────────────────────────────────────────

func TestWebhook_SubscriptionDeleted_DowngradesToFree(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_deleted"))
	setStripeIDs(t, userID, "cus_007", "sub_007")
	setPlan(t, userID, "pro")

	periodEnd := time.Now().Add(15 * 24 * time.Hour)
	w := webhook(t, "customer.subscription.deleted", map[string]any{
		"id":                 "sub_007",
		"customer":           "cus_007",
		"status":             "canceled",
		"current_period_end": periodEnd.Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, subID, expiresAt := planRow(t, userID)
	assert.Equal(t, "free", plan)
	assert.Nil(t, subID, "stripe_subscription_id must be cleared on deletion")
	require.NotNil(t, expiresAt, "plan_expires_at must reflect the paid period end")
	assert.WithinDuration(t, periodEnd, *expiresAt, time.Minute)
}

func TestWebhook_SubscriptionDeleted_WrongSubID_NoChange(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, _ := signUp(t, uniqueEmail("sub_del_wrong"))
	setStripeIDs(t, userID, "cus_008", "sub_008_real")
	setPlan(t, userID, "pro")

	w := webhook(t, "customer.subscription.deleted", map[string]any{
		"id":                 "sub_008_other",
		"customer":           "cus_008",
		"status":             "canceled",
		"current_period_end": time.Now().Unix(),
	})
	assert.Equal(t, http.StatusOK, w.Code)

	plan, _, _ := planRow(t, userID)
	assert.Equal(t, "pro", plan, "deletion of an unrelated subscription must not downgrade the user")
}

// ── Collection limits ─────────────────────────────────────────────────────────

func TestCollectionLimit_FreeUserBlockedAtThree(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("col_limit"))

	for i := 1; i <= 3; i++ {
		w := do(t, http.MethodPost, "/api/collections",
			map[string]string{"name": fmt.Sprintf("Col %d", i)}, tok)
		mustStatus(t, w, http.StatusCreated)
	}

	w := do(t, http.MethodPost, "/api/collections",
		map[string]string{"name": "Col 4"}, tok)
	mustStatus(t, w, http.StatusForbidden)
}

func TestCollectionLimit_ProUserUnlimited(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, tok := signUp(t, uniqueEmail("col_pro"))
	setPlan(t, userID, "pro")

	for i := 1; i <= 5; i++ {
		w := do(t, http.MethodPost, "/api/collections",
			map[string]string{"name": fmt.Sprintf("Col %d", i)}, tok)
		mustStatus(t, w, http.StatusCreated)
	}
}

// ── Card limits ───────────────────────────────────────────────────────────────

func TestCardLimit_FreeUserBlockedAtFifty(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("card_limit"))

	w := do(t, http.MethodPost, "/api/collections",
		map[string]string{"name": "Cards"}, tok)
	mustStatus(t, w, http.StatusCreated)
	var col struct {
		ID string `json:"id"`
	}
	decode(t, w, &col)

	// Bulk-insert 50 cards directly to avoid 50 round-trips.
	_, err := testPool.Exec(context.Background(), `
		INSERT INTO cards (collection_id, question, answer)
		SELECT $1, 'Q' || gs, 'A' || gs FROM generate_series(1, 50) gs
	`, col.ID)
	require.NoError(t, err)

	w = do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards",
		map[string]string{"question": "Q51", "answer": "A51"}, tok)
	mustStatus(t, w, http.StatusForbidden)
}

func TestCardLimit_ProUserUnlimited(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, tok := signUp(t, uniqueEmail("card_pro"))
	setPlan(t, userID, "pro")

	w := do(t, http.MethodPost, "/api/collections",
		map[string]string{"name": "Cards"}, tok)
	mustStatus(t, w, http.StatusCreated)
	var col struct {
		ID string `json:"id"`
	}
	decode(t, w, &col)

	_, err := testPool.Exec(context.Background(), `
		INSERT INTO cards (collection_id, question, answer)
		SELECT $1, 'Q' || gs, 'A' || gs FROM generate_series(1, 50) gs
	`, col.ID)
	require.NoError(t, err)

	// Pro user must be able to add the 51st card.
	w = do(t, http.MethodPost, "/api/collections/"+col.ID+"/cards",
		map[string]string{"question": "Q51", "answer": "A51"}, tok)
	mustStatus(t, w, http.StatusCreated)
}

// ── Webhook: unhandled event type ─────────────────────────────────────────────

// TestWebhook_UnknownEventType_Returns200 verifies the default: case in the
// webhook switch. Stripe expects a 200 for any event it sends — silently
// ignoring unknown types is the correct behaviour.
func TestWebhook_UnknownEventType_Returns200(t *testing.T) {
	testutil.Truncate(t, testPool)

	w := webhook(t, "invoice.payment_succeeded", map[string]any{
		"id": "in_test_123",
	})
	assert.Equal(t, http.StatusOK, w.Code)
}

// ── Webhook: checkout without customer ───────────────────────────────────────

// TestWebhook_CheckoutCompleted_NilCustomer verifies that a checkout.session
// with a subscription but no customer ID does not crash the handler.
func TestWebhook_CheckoutCompleted_NilCustomer(t *testing.T) {
	testutil.Truncate(t, testPool)

	// No customer field — UPDATE matches zero rows; must still return 200.
	w := webhook(t, "checkout.session.completed", map[string]any{
		"subscription": map[string]any{"id": "sub_orphan"},
		"status":       "complete",
	})
	assert.Equal(t, http.StatusOK, w.Code)
}
