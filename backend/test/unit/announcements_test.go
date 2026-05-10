package unit_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/smithlabs/flashr/backend/internal/announcements"
)

// ── parse ─────────────────────────────────────────────────────────────────────

func TestParse_ValidYAML(t *testing.T) {
	md := []byte("# Notes\n\n```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: First release.\n```\n")
	releases, err := announcements.Parse(md)
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, "1.0.0", releases[0].Version)
	assert.Equal(t, "2026-05-10", releases[0].Date)
	assert.Equal(t, "MVP", releases[0].Title)
	assert.Equal(t, "First release.", releases[0].Description)
}

func TestParse_MultipleReleases(t *testing.T) {
	md := []byte("```yaml\n- version: 2.0.0\n  date: \"2026-06-01\"\n  title: V2\n  description: Second.\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: V1\n  description: First.\n```\n")
	releases, err := announcements.Parse(md)
	require.NoError(t, err)
	assert.Len(t, releases, 2)
	assert.Equal(t, "2.0.0", releases[0].Version)
	assert.Equal(t, "1.0.0", releases[1].Version)
}

func TestParse_NoYAMLBlock(t *testing.T) {
	releases, err := announcements.Parse([]byte("# No yaml here"))
	require.NoError(t, err)
	assert.Empty(t, releases)
}

func TestParse_EmptyYAMLBlock(t *testing.T) {
	releases, err := announcements.Parse([]byte("```yaml\n```"))
	require.NoError(t, err)
	assert.Empty(t, releases)
}

func TestParse_InvalidYAML(t *testing.T) {
	_, err := announcements.Parse([]byte("```yaml\n: bad: [yaml\n```"))
	assert.Error(t, err)
}

// ── fetchFromBranch ───────────────────────────────────────────────────────────

func TestFetchFromBranch_ReturnsReleases(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hello.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.FetchFromBranch("main")
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, "1.0.0", releases[0].Version)
}

func TestFetchFromBranch_404ReturnsEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.FetchFromBranch("main")
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

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	svc.SetToken("test-token")
	_, err := svc.FetchFromBranch("main")
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

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL)
	branches, err := svc.ListBranches()
	require.NoError(t, err)
	assert.Equal(t, []string{"main", "feature-announcements", "feature-payments"}, branches)
}

// ── load ─────────────────────────────────────────────────────────────────────

func TestLoad_MainHasContent(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hi.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.Load()
	require.NoError(t, err)
	require.Len(t, releases, 1)
	assert.Equal(t, 1, calls, "branches endpoint must not be called when main has content")
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

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.Load()
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
			t.Errorf("unexpected branch fetch: %s", r.URL.Path)
		}
	}))
	t.Cleanup(srv.Close)

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	releases, err := svc.Load()
	require.NoError(t, err)
	assert.Empty(t, releases)
}

// ── cache ─────────────────────────────────────────────────────────────────────

func TestCache_WarmCacheIsValid(t *testing.T) {
	svc := announcements.NewTestService("http://unused/%s", "http://unused/branches")
	primed := []announcements.Release{{Version: "1.0.0"}}
	svc.SetCache(primed, time.Now().Add(5*time.Minute))

	cached, expiry := svc.GetCache()
	assert.True(t, time.Now().Before(expiry))
	assert.Equal(t, primed, cached)
}

func TestCache_ExpiredTriggersRefetch(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte("```yaml\n- version: 1.0.0\n  date: \"2026-05-10\"\n  title: MVP\n  description: Hi.\n```\n"))
	}))
	t.Cleanup(srv.Close)

	svc := announcements.NewTestService(srv.URL+"/%s", srv.URL+"/branches")
	svc.SetCache([]announcements.Release{{Version: "0.9.0"}}, time.Now().Add(-time.Second))

	releases, err := svc.Load()
	require.NoError(t, err)
	assert.Equal(t, "1.0.0", releases[0].Version)
	assert.Equal(t, 1, calls)
}
