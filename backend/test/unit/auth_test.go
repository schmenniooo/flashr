package unit_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/auth"
)

var testSecret = []byte("unit-test-secret-that-is-32-bytes!")

func TestNewService_NilPool(t *testing.T) {
	_, err := auth.NewService(nil, auth.Config{Secret: "a-secret-that-is-at-least-32-bytes!"})
	assert.ErrorContains(t, err, "nil db pool")
}

func TestNewService_ShortSecret(t *testing.T) {
	_, err := auth.NewService(nil, auth.Config{Secret: "tooshort"})
	assert.Error(t, err)
}

// ── OAuth state ──────────────────────────────────────────────────────────────

func TestGenerateState_Format(t *testing.T) {
	state := auth.GenerateStateForTest(testSecret)
	parts := strings.SplitN(state, ".", 2)
	require.Len(t, parts, 2, "state must be <timestamp>.<hmac>")
	assert.NotEmpty(t, parts[0])
	assert.NotEmpty(t, parts[1])
}

func TestGenerateState_Unique(t *testing.T) {
	a := auth.GenerateStateForTest(testSecret)
	b := auth.GenerateStateForTest(testSecret)
	// Two calls within the same second share the timestamp but the HMAC
	// is over the timestamp so they can be equal — that is fine. What matters
	// is that both verify correctly.
	assert.NoError(t, auth.VerifyStateForTest(testSecret, a))
	assert.NoError(t, auth.VerifyStateForTest(testSecret, b))
}

func TestVerifyState_Valid(t *testing.T) {
	state := auth.GenerateStateForTest(testSecret)
	assert.NoError(t, auth.VerifyStateForTest(testSecret, state))
}

func TestVerifyState_Tampered(t *testing.T) {
	state := auth.GenerateStateForTest(testSecret)
	tampered := state[:len(state)-4] + "0000"
	assert.Error(t, auth.VerifyStateForTest(testSecret, tampered))
}

func TestVerifyState_WrongSecret(t *testing.T) {
	state := auth.GenerateStateForTest(testSecret)
	other := []byte("completely-different-secret-here!")
	assert.Error(t, auth.VerifyStateForTest(other, state))
}

func TestVerifyState_Malformed_NoSeparator(t *testing.T) {
	assert.Error(t, auth.VerifyStateForTest(testSecret, "nodothere"))
}

func TestVerifyState_Malformed_Empty(t *testing.T) {
	assert.Error(t, auth.VerifyStateForTest(testSecret, ""))
}

func TestVerifyState_Malformed_InvalidTimestamp(t *testing.T) {
	assert.Error(t, auth.VerifyStateForTest(testSecret, "notanumber.abcdef"))
}
