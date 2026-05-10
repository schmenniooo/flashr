package announcements

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── parse ─────────────────────────────────────────────────────────────────────

func TestParse_ValidYAML(t *testing.T) {
	md := []byte("# Notes\n\n```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: First release.\n```\n")
	releases, err := parse(md)
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, "1.0.0", releases[0].Version)
	assert.Equal(t, "2026-05-10", releases[0].Date)
	assert.Equal(t, "MVP", releases[0].Title)
	assert.Equal(t, "First release.", releases[0].Description)
}

func TestParse_MultipleReleases(t *testing.T) {
	md := []byte("```yaml\n- version: 2.0.0\n  date: \"2026-06-01\"\n  title: V2\n  description: Second.\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: V1\n  description: First.\n```\n")
	releases, err := parse(md)
	require.NoError(t, err)
	assert.Len(t, releases, 2)
	assert.Equal(t, "2.0.0", releases[0].Version)
	assert.Equal(t, "1.0.0", releases[1].Version)
}

func TestParse_NoYAMLBlock(t *testing.T) {
	releases, err := parse([]byte("# No yaml here"))
	require.NoError(t, err)
	assert.Empty(t, releases)
}

func TestParse_EmptyYAMLBlock(t *testing.T) {
	releases, err := parse([]byte("```yaml\n```"))
	require.NoError(t, err)
	assert.Empty(t, releases)
}

func TestParse_InvalidYAML(t *testing.T) {
	_, err := parse([]byte("```yaml\n: bad: [yaml\n```"))
	assert.Error(t, err)
}

// ── fetchFromBranch ───────────────────────────────────────────────────────────

func TestFetchFromBranch_ReturnsReleases(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hello.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.fetchFromBranch("main")
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, "1.0.0", releases[0].Version)
}

func TestFetchFromBranch_404ReturnsEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.fetchFromBranch("main")
	require.NoError(t, err)
	assert.Empty(t, releases)
}

func TestFetchFromBranch_SendsAuthHeader(t *testing.T) {
	var gotAuth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Write([]byte("```yaml\n```"))
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	svc.token = "test-token"
	_, err := svc.fetchFromBranch("main")
	require.NoError(t, err)
	assert.Equal(t, "Bearer test-token", gotAuth)
}

// ── listBranches ──────────────────────────────────────────────────────────────

func TestListBranches_ReturnsBranchNames(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]map[string]any{
			{"name": "main"},
			{"name": "feature-announcements"},
			{"name": "feature-payments"},
		})
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL)
	branches, err := svc.listBranches()
	require.NoError(t, err)
	assert.Equal(t, []string{"main", "feature-announcements", "feature-payments"}, branches)
}

// ── load ─────────────────────────────────────────────────────────────────────

func TestLoad_MainHasContent(t *testing.T) {
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.Path)
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hi.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.load()
	require.NoError(t, err)
	require.Len(t, releases, 1)
	// branches endpoint must not be called when main has content
	assert.Len(t, calls, 1)
}

func TestLoad_MainEmptyFallsBackToFeatureBranch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/main":
			w.Write([]byte("# No yaml block"))
		case "/branches":
			json.NewEncoder(w).Encode([]map[string]any{
				{"name": "main"},
				{"name": "feature-release-notes"},
			})
		default:
			w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: From branch.\n```\n"))
		}
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.load()
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, "From branch.", releases[0].Description)
}

func TestLoad_SkipsNonFeatureBranches(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/main":
			w.Write([]byte("# empty"))
		case "/branches":
			json.NewEncoder(w).Encode([]map[string]any{
				{"name": "main"},
				{"name": "hotfix-crash"},
				{"name": "release-v2"},
			})
		default:
			// Should never be called for non-feature branches.
			t.Errorf("unexpected branch fetch: %s", r.URL.Path)
		}
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.load()
	require.NoError(t, err)
	assert.Empty(t, releases)
}

// ── cache ─────────────────────────────────────────────────────────────────────

func TestCache_SecondCallNotFetched(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hi.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")

	r1, err := svc.load()
	require.NoError(t, err)

	// Manually prime the cache as handle() would.
	svc.mu.Lock()
	svc.cache = r1
	svc.expiry = time.Now().Add(cacheTTL)
	svc.mu.Unlock()

	// A second load call must not happen while cache is warm.
	callsBefore := calls
	svc.mu.Lock()
	cached := svc.cache
	valid := time.Now().Before(svc.expiry)
	svc.mu.Unlock()

	assert.True(t, valid)
	assert.Equal(t, r1, cached)
	assert.Equal(t, callsBefore, calls)
}

func TestCache_ExpiredTriggersRefetch(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hi.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := testService(t, srv.URL+"/%s", srv.URL+"/branches")

	// Prime cache but mark it already expired.
	svc.mu.Lock()
	svc.cache = []Release{{Version: "0.9.0"}}
	svc.expiry = time.Now().Add(-time.Second)
	svc.mu.Unlock()

	releases, err := svc.load()
	require.NoError(t, err)
	assert.Equal(t, "1.0.0", releases[0].Version)
	assert.Equal(t, 1, calls)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func testService(t *testing.T, rawURLTemplate, branchesURL string) *service {
	t.Helper()
	return &service{
		rawURLTemplate: rawURLTemplate,
		branchesURL:    branchesURL,
		client:         &http.Client{Timeout: 5 * time.Second},
	}
}
