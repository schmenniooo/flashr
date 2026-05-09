//go:build integration

package integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
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
		Token string    `json:"token"`
		User  auth.User `json:"user"`
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

// ── OAuth ────────────────────────────────────────────────────────────────────

// oauthRouter builds a router with fake Google + GitHub credentials so that
// the OAuth routes are registered without requiring real provider secrets.
func oauthRouter(t *testing.T) *gin.Engine {
	t.Helper()
	svc, err := auth.NewService(testPool, auth.Config{
		Secret:             testSecret,
		GoogleClientID:     "fake-google-id",
		GoogleClientSecret: "fake-google-secret",
		GoogleRedirectURL:  "http://localhost:8080/api/auth/google/callback",
		GithubClientID:     "fake-github-id",
		GithubClientSecret: "fake-github-secret",
		GithubRedirectURL:  "http://localhost:8080/api/auth/github/callback",
		FrontendURL:        "http://localhost:5173",
	})
	require.NoError(t, err)
	r := gin.New()
	svc.RegisterRoutes(r.Group("/api/auth"))
	return r
}

func doOAuth(t *testing.T, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	w := httptest.NewRecorder()
	oauthRouter(t).ServeHTTP(w, req)
	return w
}

func TestHTTP_GoogleRedirect(t *testing.T) {
	w := doOAuth(t, http.MethodGet, "/api/auth/google")
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	loc := w.Header().Get("Location")
	assert.Contains(t, loc, "accounts.google.com")
	assert.Contains(t, loc, "fake-google-id")
}

func TestHTTP_GithubRedirect(t *testing.T) {
	w := doOAuth(t, http.MethodGet, "/api/auth/github")
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	loc := w.Header().Get("Location")
	assert.Contains(t, loc, "github.com")
	assert.Contains(t, loc, "fake-github-id")
}

func TestHTTP_OAuthRoutes_DisabledWithoutCreds(t *testing.T) {
	// testRouter has no OAuth creds — routes must not be registered.
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/auth/google", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)

	w = httptest.NewRecorder()
	testRouter.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/auth/github", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestHTTP_OAuthCallback_InvalidState(t *testing.T) {
	w := doOAuth(t, http.MethodGet, "/api/auth/google/callback?state=tampered&code=irrelevant")
	assert.Equal(t, http.StatusBadRequest, w.Code)

	w = doOAuth(t, http.MethodGet, "/api/auth/github/callback?state=tampered&code=irrelevant")
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHTTP_OAuthCallback_MissingCode(t *testing.T) {
	svc, err := auth.NewService(testPool, auth.Config{
		Secret:             testSecret,
		GoogleClientID:     "fake-google-id",
		GoogleClientSecret: "fake-google-secret",
		GoogleRedirectURL:  "http://localhost:8080/api/auth/google/callback",
		FrontendURL:        "http://localhost:5173",
	})
	require.NoError(t, err)
	validState := svc.GenerateState()

	w := doOAuth(t, http.MethodGet, "/api/auth/google/callback?state="+validState)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestOAuthUpsert_NewUser(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, tok, expires, err := testAuthSvc.OAuthUpsert(context.Background(), "oauth@example.com", "OAuth User", "google")
	require.NoError(t, err)
	assert.Equal(t, "oauth@example.com", u.Email)
	assert.Equal(t, "OAuth User", u.Name)
	assert.NotEmpty(t, tok)
	assert.False(t, expires.IsZero())
}

func TestOAuthUpsert_LinksExistingEmailAccount(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	// Create an email/password user first.
	existing, _, _, err := testAuthSvc.SignUp(ctx, "link@example.com", "password123", "Link User")
	require.NoError(t, err)

	// Same email logs in via Google — should return the same user ID.
	u, tok, _, err := testAuthSvc.OAuthUpsert(ctx, "link@example.com", "Link User", "google")
	require.NoError(t, err)
	assert.Equal(t, existing.ID, u.ID)
	assert.NotEmpty(t, tok)
}

func TestOAuthUpsert_EmailNormalised(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, _, _, err := testAuthSvc.OAuthUpsert(context.Background(), "  OAuth@Example.COM  ", "Test", "github")
	require.NoError(t, err)
	assert.Equal(t, "oauth@example.com", u.Email)
}

func TestOAuthUpsert_PreservesExistingName(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	// User already has a name set.
	_, _, _, err := testAuthSvc.SignUp(ctx, "named@example.com", "password123", "Original Name")
	require.NoError(t, err)

	// OAuth login with a different name — original name must be kept.
	u, _, _, err := testAuthSvc.OAuthUpsert(ctx, "named@example.com", "Google Name", "google")
	require.NoError(t, err)
	assert.Equal(t, "Original Name", u.Name)
}

// ── DELETE /auth/me ───────────────────────────────────────────────────────────

func TestHTTP_DeleteMe_RemovesUser(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, tok := signUp(t, uniqueEmail("delete_me"))

	w := do(t, http.MethodDelete, "/api/auth/me", nil, tok)
	mustStatus(t, w, http.StatusNoContent)

	// User must no longer exist.
	_, err := testAuthSvc.UserByID(context.Background(), userID)
	assert.ErrorIs(t, err, auth.ErrUserNotFound)
}

func TestHTTP_DeleteMe_Unauthenticated(t *testing.T) {
	w := do(t, http.MethodDelete, "/api/auth/me", nil, "")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestHTTP_DeleteMe_InvalidToken(t *testing.T) {
	w := do(t, http.MethodDelete, "/api/auth/me", nil, "not.a.jwt")
	mustStatus(t, w, http.StatusUnauthorized)
}

// ── HTTP signup / login edge cases ───────────────────────────────────────────

func TestHTTP_SignUp_MissingEmail(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"password": "password123",
	}, "")
	mustStatus(t, w, http.StatusBadRequest)
}

func TestHTTP_SignUp_MissingPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "nopw@example.com",
	}, "")
	mustStatus(t, w, http.StatusBadRequest)
}

func TestHTTP_SignUp_WeakPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "weak@example.com", "password": "short",
	}, "")
	mustStatus(t, w, http.StatusBadRequest)
}

func TestHTTP_SignUp_DuplicateEmail(t *testing.T) {
	testutil.Truncate(t, testPool)
	body := map[string]string{"email": "dup_http@example.com", "password": "password123"}
	mustStatus(t, do(t, http.MethodPost, "/api/auth/signup", body, ""), http.StatusCreated)
	mustStatus(t, do(t, http.MethodPost, "/api/auth/signup", body, ""), http.StatusConflict)
}

func TestHTTP_Login_WrongPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "wrongpw@example.com", "password": "correct-horse",
	}, "")

	w := do(t, http.MethodPost, "/api/auth/login", map[string]string{
		"email": "wrongpw@example.com", "password": "wrong-password",
	}, "")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestHTTP_Login_UnknownUser(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/login", map[string]string{
		"email": "ghost@example.com", "password": "anything",
	}, "")
	mustStatus(t, w, http.StatusUnauthorized)
}
