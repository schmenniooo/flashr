//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

func TestSignUp(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, tok, expires, err := testAuthSvc.SignUp(context.Background(), "alice@example.com", "password123", "Alice")
	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", u.Email)
	assert.Equal(t, "Alice", u.Name)
	assert.NotEmpty(t, tok)
	assert.False(t, expires.IsZero())
}

func TestSignUp_EmailNormalised(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, _, _, err := testAuthSvc.SignUp(context.Background(), "  Alice@Example.COM  ", "password123", "")
	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", u.Email)
}

func TestSignUp_DuplicateEmail(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, _, err := testAuthSvc.SignUp(ctx, "dup@example.com", "password123", "")
	require.NoError(t, err)

	_, _, _, err = testAuthSvc.SignUp(ctx, "dup@example.com", "password123", "")
	assert.ErrorIs(t, err, auth.ErrEmailTaken)
}

func TestSignUp_WeakPassword(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, _, err := testAuthSvc.SignUp(context.Background(), "user@example.com", "short", "")
	assert.ErrorIs(t, err, auth.ErrWeakPassword)
}

func TestSignUp_InvalidEmail(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, _, err := testAuthSvc.SignUp(context.Background(), "not-an-email", "password123", "")
	assert.ErrorIs(t, err, auth.ErrInvalidEmail)
}

func TestLogin(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, _, err := testAuthSvc.SignUp(ctx, "bob@example.com", "password123", "Bob")
	require.NoError(t, err)

	u, tok, expires, err := testAuthSvc.Login(ctx, "bob@example.com", "password123")
	require.NoError(t, err)
	assert.Equal(t, "bob@example.com", u.Email)
	assert.NotEmpty(t, tok)
	assert.False(t, expires.IsZero())
}

func TestLogin_CaseInsensitive(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, _, err := testAuthSvc.SignUp(ctx, "carol@example.com", "password123", "Carol")
	require.NoError(t, err)

	_, _, _, err = testAuthSvc.Login(ctx, "CAROL@EXAMPLE.COM", "password123")
	assert.NoError(t, err)
}

func TestLogin_WrongPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, _, err := testAuthSvc.SignUp(ctx, "dave@example.com", "correct-horse", "Dave")
	require.NoError(t, err)

	_, _, _, err = testAuthSvc.Login(ctx, "dave@example.com", "wrong-password")
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestLogin_UnknownEmail(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, _, err := testAuthSvc.Login(context.Background(), "nobody@example.com", "anything")
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestUserByID(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	created, _, _, err := testAuthSvc.SignUp(ctx, "eve@example.com", "password123", "Eve")
	require.NoError(t, err)

	found, err := testAuthSvc.UserByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
	assert.Equal(t, "eve@example.com", found.Email)
}

func TestUserByID_NotFound(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, err := testAuthSvc.UserByID(context.Background(), "00000000-0000-0000-0000-000000000000")
	assert.ErrorIs(t, err, auth.ErrUserNotFound)
}

func TestParseToken_RoundTrip(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	created, tok, _, err := testAuthSvc.SignUp(ctx, "frank@example.com", "password123", "Frank")
	require.NoError(t, err)

	userID, err := testAuthSvc.ParseToken(tok)
	require.NoError(t, err)
	assert.Equal(t, created.ID, userID)
}

func TestParseToken_Invalid(t *testing.T) {
	_, err := testAuthSvc.ParseToken("not.a.valid.token")
	assert.ErrorIs(t, err, auth.ErrInvalidToken)
}

func TestNewService_ShortSecret(t *testing.T) {
	_, err := auth.NewService(testPool, auth.Config{Secret: "tooshort"})
	assert.ErrorContains(t, err, "32 bytes")
}

// HTTP handler tests

func TestHTTP_SignUp(t *testing.T) {
	testutil.Truncate(t, testPool)

	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "http_alice@example.com", "password": "password123", "name": "Alice",
	}, "")
	mustStatus(t, w, http.StatusCreated)

	var resp struct {
		Token string      `json:"token"`
		User  auth.User   `json:"user"`
	}
	decode(t, w, &resp)
	assert.Equal(t, "http_alice@example.com", resp.User.Email)
	assert.NotEmpty(t, resp.Token)
}

func TestHTTP_Login(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, _, _, _ = testAuthSvc.SignUp(context.Background(), "http_bob@example.com", "password123", "Bob")

	w := do(t, http.MethodPost, "/api/auth/login", map[string]string{
		"email": "http_bob@example.com", "password": "password123",
	}, "")
	mustStatus(t, w, http.StatusOK)
}

func TestHTTP_Me_Unauthenticated(t *testing.T) {
	w := do(t, http.MethodGet, "/api/auth/me", nil, "")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestHTTP_Me_Authenticated(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, tok := signUp(t, uniqueEmail("me_user"))

	w := do(t, http.MethodGet, "/api/auth/me", nil, tok)
	mustStatus(t, w, http.StatusOK)
}
