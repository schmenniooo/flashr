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

	u, pair, err := testAuthSvc.SignUp(context.Background(), "alice@example.com", "password123", "Alice")
	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", u.Email)
	assert.Equal(t, "Alice", u.Name)
	assert.NotEmpty(t, pair.AccessToken)
	assert.NotEmpty(t, pair.RefreshToken)
	assert.False(t, pair.AccessExpiry.IsZero())
	assert.False(t, pair.RefreshExpiry.IsZero())
}

func TestSignUp_EmailNormalised(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, _, err := testAuthSvc.SignUp(context.Background(), "  Alice@Example.COM  ", "password123", "")
	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", u.Email)
}

func TestSignUp_DuplicateEmail(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, err := testAuthSvc.SignUp(ctx, "dup@example.com", "password123", "")
	require.NoError(t, err)

	_, _, err = testAuthSvc.SignUp(ctx, "dup@example.com", "password123", "")
	assert.ErrorIs(t, err, auth.ErrEmailTaken)
}

func TestSignUp_WeakPassword(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, err := testAuthSvc.SignUp(context.Background(), "user@example.com", "short", "")
	assert.ErrorIs(t, err, auth.ErrWeakPassword)
}

func TestSignUp_InvalidEmail(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, err := testAuthSvc.SignUp(context.Background(), "not-an-email", "password123", "")
	assert.ErrorIs(t, err, auth.ErrInvalidEmail)
}

func TestLogin(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, err := testAuthSvc.SignUp(ctx, "bob@example.com", "password123", "Bob")
	require.NoError(t, err)

	u, pair, err := testAuthSvc.Login(ctx, "bob@example.com", "password123")
	require.NoError(t, err)
	assert.Equal(t, "bob@example.com", u.Email)
	assert.NotEmpty(t, pair.AccessToken)
	assert.False(t, pair.AccessExpiry.IsZero())
}

func TestLogin_CaseInsensitive(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, err := testAuthSvc.SignUp(ctx, "carol@example.com", "password123", "Carol")
	require.NoError(t, err)

	_, _, err = testAuthSvc.Login(ctx, "CAROL@EXAMPLE.COM", "password123")
	assert.NoError(t, err)
}

func TestLogin_WrongPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, err := testAuthSvc.SignUp(ctx, "dave@example.com", "correct-horse", "Dave")
	require.NoError(t, err)

	_, _, err = testAuthSvc.Login(ctx, "dave@example.com", "wrong-password")
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestLogin_UnknownEmail(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, err := testAuthSvc.Login(context.Background(), "nobody@example.com", "anything")
	assert.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestUserByID(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	created, _, err := testAuthSvc.SignUp(ctx, "eve@example.com", "password123", "Eve")
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

	created, pair, err := testAuthSvc.SignUp(ctx, "frank@example.com", "password123", "Frank")
	require.NoError(t, err)

	userID, plan, err := testAuthSvc.ParseToken(pair.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, created.ID, userID)
	assert.Equal(t, "free", plan)
}

func TestParseToken_Invalid(t *testing.T) {
	_, _, err := testAuthSvc.ParseToken("not.a.valid.token")
	assert.ErrorIs(t, err, auth.ErrInvalidToken)
}

func TestNewService_ShortSecret(t *testing.T) {
	_, err := auth.NewService(testPool, auth.Config{Secret: "tooshort"})
	assert.ErrorContains(t, err, "32 bytes")
}

// ── Refresh token rotation ────────────────────────────────────────────────────

func TestRotateRefreshToken_Success(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, pair, err := testAuthSvc.SignUp(ctx, "rotate@example.com", "password123", "Rotate")
	require.NoError(t, err)

	user, newPair, err := testAuthSvc.RotateRefreshToken(ctx, pair.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, "rotate@example.com", user.Email)
	assert.NotEmpty(t, newPair.AccessToken)
	assert.NotEmpty(t, newPair.RefreshToken)
	// New refresh token must differ from the old one.
	assert.NotEqual(t, pair.RefreshToken, newPair.RefreshToken)
}

func TestRotateRefreshToken_OldTokenRejected(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, pair, err := testAuthSvc.SignUp(ctx, "reuse@example.com", "password123", "Reuse")
	require.NoError(t, err)

	// First rotation succeeds.
	_, _, err = testAuthSvc.RotateRefreshToken(ctx, pair.RefreshToken)
	require.NoError(t, err)

	// Second use of the original token must fail (token was deleted on rotation).
	_, _, err = testAuthSvc.RotateRefreshToken(ctx, pair.RefreshToken)
	assert.ErrorIs(t, err, auth.ErrRefreshTokenInvalid)
}

func TestRotateRefreshToken_InvalidToken(t *testing.T) {
	testutil.Truncate(t, testPool)

	_, _, err := testAuthSvc.RotateRefreshToken(context.Background(), "completely-fake-token")
	assert.ErrorIs(t, err, auth.ErrRefreshTokenInvalid)
}

func TestRevokeRefreshToken(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, pair, err := testAuthSvc.SignUp(ctx, "revoke@example.com", "password123", "Revoke")
	require.NoError(t, err)

	require.NoError(t, testAuthSvc.RevokeRefreshToken(ctx, pair.RefreshToken))

	_, _, err = testAuthSvc.RotateRefreshToken(ctx, pair.RefreshToken)
	assert.ErrorIs(t, err, auth.ErrRefreshTokenInvalid)
}

// ── HTTP handler tests ────────────────────────────────────────────────────────

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
	// Refresh cookie must be set.
	cookies := w.Result().Cookies()
	var refreshCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "flashr_rt" {
			refreshCookie = c
		}
	}
	require.NotNil(t, refreshCookie, "flashr_rt cookie must be set on signup")
	assert.True(t, refreshCookie.HttpOnly)
}

func TestHTTP_Login(t *testing.T) {
	testutil.Truncate(t, testPool)
	_, _, _ = testAuthSvc.SignUp(context.Background(), "http_bob@example.com", "password123", "Bob")

	w := do(t, http.MethodPost, "/api/auth/login", map[string]string{
		"email": "http_bob@example.com", "password": "password123",
	}, "")
	mustStatus(t, w, http.StatusOK)
	cookies := w.Result().Cookies()
	var hasRefresh bool
	for _, c := range cookies {
		if c.Name == "flashr_rt" {
			hasRefresh = true
		}
	}
	assert.True(t, hasRefresh, "flashr_rt cookie must be set on login")
}

func TestHTTP_Refresh_Success(t *testing.T) {
	testutil.Truncate(t, testPool)

	// Sign up via HTTP to get the refresh cookie value.
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "refresh_user@example.com", "password": "password123",
	}, "")
	mustStatus(t, w, http.StatusCreated)

	var firstResp struct{ Token string `json:"token"` }
	decode(t, w, &firstResp)

	var refreshCookieValue string
	for _, c := range w.Result().Cookies() {
		if c.Name == "flashr_rt" {
			refreshCookieValue = c.Value
		}
	}
	require.NotEmpty(t, refreshCookieValue)

	// Call /refresh with the cookie.
	w2 := doWithCookie(t, http.MethodPost, "/api/auth/refresh", nil, "", "flashr_rt", refreshCookieValue)
	mustStatus(t, w2, http.StatusOK)

	var refreshResp struct {
		Token string    `json:"token"`
		User  auth.User `json:"user"`
	}
	decode(t, w2, &refreshResp)
	assert.NotEmpty(t, refreshResp.Token)
	assert.Equal(t, "refresh_user@example.com", refreshResp.User.Email)

	// A new refresh cookie must be issued.
	var newCookieValue string
	for _, c := range w2.Result().Cookies() {
		if c.Name == "flashr_rt" {
			newCookieValue = c.Value
		}
	}
	require.NotEmpty(t, newCookieValue)
	assert.NotEqual(t, refreshCookieValue, newCookieValue, "cookie must be rotated")
}

func TestHTTP_Refresh_NoCookie(t *testing.T) {
	w := do(t, http.MethodPost, "/api/auth/refresh", nil, "")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestHTTP_Refresh_InvalidCookie(t *testing.T) {
	w := doWithCookie(t, http.MethodPost, "/api/auth/refresh", nil, "", "flashr_rt", "not-a-valid-token")
	mustStatus(t, w, http.StatusUnauthorized)
}

func TestHTTP_Logout_RevokesToken(t *testing.T) {
	testutil.Truncate(t, testPool)

	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{
		"email": "logout_user@example.com", "password": "password123",
	}, "")
	mustStatus(t, w, http.StatusCreated)

	var refreshCookieValue string
	for _, c := range w.Result().Cookies() {
		if c.Name == "flashr_rt" {
			refreshCookieValue = c.Value
		}
	}
	require.NotEmpty(t, refreshCookieValue)

	// Log out.
	wOut := doWithCookie(t, http.MethodPost, "/api/auth/logout", nil, "", "flashr_rt", refreshCookieValue)
	mustStatus(t, wOut, http.StatusNoContent)

	// The old refresh token must now be invalid.
	_, _, err := testAuthSvc.RotateRefreshToken(context.Background(), refreshCookieValue)
	assert.ErrorIs(t, err, auth.ErrRefreshTokenInvalid)
}

func TestHTTP_Logout_NoCookie_IsNoOp(t *testing.T) {
	// Logout without a cookie should be idempotent (204, not an error).
	w := do(t, http.MethodPost, "/api/auth/logout", nil, "")
	mustStatus(t, w, http.StatusNoContent)
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

// ── OAuth ─────────────────────────────────────────────────────────────────────

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

	u, pair, err := testAuthSvc.OAuthUpsert(context.Background(), "oauth@example.com", "OAuth User", "google")
	require.NoError(t, err)
	assert.Equal(t, "oauth@example.com", u.Email)
	assert.Equal(t, "OAuth User", u.Name)
	assert.NotEmpty(t, pair.AccessToken)
	assert.NotEmpty(t, pair.RefreshToken)
}

func TestOAuthUpsert_LinksExistingEmailAccount(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	existing, _, err := testAuthSvc.SignUp(ctx, "link@example.com", "password123", "Link User")
	require.NoError(t, err)

	u, pair, err := testAuthSvc.OAuthUpsert(ctx, "link@example.com", "Link User", "google")
	require.NoError(t, err)
	assert.Equal(t, existing.ID, u.ID)
	assert.NotEmpty(t, pair.AccessToken)
}

func TestOAuthUpsert_EmailNormalised(t *testing.T) {
	testutil.Truncate(t, testPool)

	u, _, err := testAuthSvc.OAuthUpsert(context.Background(), "  OAuth@Example.COM  ", "Test", "github")
	require.NoError(t, err)
	assert.Equal(t, "oauth@example.com", u.Email)
}

func TestOAuthUpsert_PreservesExistingName(t *testing.T) {
	testutil.Truncate(t, testPool)
	ctx := context.Background()

	_, _, err := testAuthSvc.SignUp(ctx, "named@example.com", "password123", "Original Name")
	require.NoError(t, err)

	u, _, err := testAuthSvc.OAuthUpsert(ctx, "named@example.com", "Google Name", "google")
	require.NoError(t, err)
	assert.Equal(t, "Original Name", u.Name)
}

// ── DELETE /auth/me ───────────────────────────────────────────────────────────

func TestHTTP_DeleteMe_RemovesUser(t *testing.T) {
	testutil.Truncate(t, testPool)
	userID, tok := signUp(t, uniqueEmail("delete_me"))

	w := do(t, http.MethodDelete, "/api/auth/me", nil, tok)
	mustStatus(t, w, http.StatusNoContent)

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

// ── HTTP signup / login edge cases ────────────────────────────────────────────

func TestHTTP_SignUp_MissingEmail(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{"password": "password123"}, "")
	mustStatus(t, w, http.StatusBadRequest)
}

func TestHTTP_SignUp_MissingPassword(t *testing.T) {
	testutil.Truncate(t, testPool)
	w := do(t, http.MethodPost, "/api/auth/signup", map[string]string{"email": "nopw@example.com"}, "")
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
