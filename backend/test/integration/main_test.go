//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/test/testutil"
)

var (
	testPool    *pgxpool.Pool
	testAuthSvc *auth.Service
	testRouter  *gin.Engine
)

const testSecret = "integration-test-secret-32-bytes!"

func TestMain(m *testing.M) {
	pool, cleanup, err := testutil.SetupDB()
	if err != nil {
		log.Fatalf("setup test db: %v", err)
	}
	testPool = pool

	testAuthSvc, err = auth.NewService(pool, auth.Config{Secret: testSecret})
	if err != nil {
		log.Fatalf("create auth service: %v", err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	api := r.Group("/api")
	testAuthSvc.RegisterRoutes(api.Group("/auth"))
	collections.NewService(pool).RegisterRoutes(api, testAuthSvc.RequireUser())
	testRouter = r

	code := m.Run()
	cleanup()
	os.Exit(code)
}

// signUp creates a fresh user and returns their ID and bearer token.
func signUp(t *testing.T, email string) (userID, token string) {
	t.Helper()
	u, tok, _, err := testAuthSvc.SignUp(context.Background(), email, "password123", "Test User")
	require.NoError(t, err)
	return u.ID, tok
}

// uniqueEmail returns an email address that is unique within this test run.
func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s+%d@example.com", prefix, time.Now().UnixNano())
}

// do fires an HTTP request against the test router and returns the recorder.
func do(t *testing.T, method, path string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()
	var reqBody *bytes.Buffer
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		reqBody = bytes.NewBuffer(b)
	} else {
		reqBody = &bytes.Buffer{}
	}
	req := httptest.NewRequest(method, path, reqBody)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	testRouter.ServeHTTP(w, req)
	return w
}

// decode unmarshals the response body into v.
func decode(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	require.NoError(t, json.NewDecoder(w.Body).Decode(v))
}

// mustStatus asserts the response has the expected HTTP status.
func mustStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	require.Equal(t, want, w.Code, "body: %s", w.Body.String())
}
