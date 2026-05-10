package announcements

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

const cacheTTL = 5 * time.Minute

var yamlBlockRe = regexp.MustCompile("(?s)```yaml\n(.*?)```")

type Release struct {
	Version     string `yaml:"version" json:"version"`
	Date        string `yaml:"date" json:"date"`
	Title       string `yaml:"title" json:"title"`
	Description string `yaml:"description" json:"description"`
}

type Service struct {
	token          string
	RawURLTemplate string
	BranchesURL    string
	Client         *http.Client

	mu     sync.Mutex
	cache  []Release
	expiry time.Time
}

func newService(token string) *Service {
	return &Service{
		token:          token,
		RawURLTemplate: "https://raw.githubusercontent.com/schmenniooo/flashr/%s/ANNOUNCEMENTS.md",
		BranchesURL:    "https://api.github.com/repos/schmenniooo/flashr/branches",
		Client:         &http.Client{Timeout: 5 * time.Second},
	}
}

// NewTestService builds a Service with custom URLs for use in tests.
func NewTestService(rawURLTemplate, branchesURL string) *Service {
	return &Service{
		RawURLTemplate: rawURLTemplate,
		BranchesURL:    branchesURL,
		Client:         &http.Client{Timeout: 5 * time.Second},
	}
}

func RegisterRoutes(rg *gin.RouterGroup, githubToken string) {
	svc := newService(githubToken)
	rg.GET("/announcements", svc.handle)
}

func (s *Service) handle(c *gin.Context) {
	s.mu.Lock()
	if time.Now().Before(s.expiry) {
		result := s.cache
		s.mu.Unlock()
		c.JSON(http.StatusOK, result)
		return
	}
	s.mu.Unlock()

	releases, err := s.Load()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load announcements"})
		return
	}

	s.mu.Lock()
	s.cache = releases
	s.expiry = time.Now().Add(cacheTTL)
	s.mu.Unlock()

	c.JSON(http.StatusOK, releases)
}

func (s *Service) Load() ([]Release, error) {
	releases, err := s.FetchFromBranch("main")
	if err != nil {
		return nil, err
	}
	if len(releases) > 0 {
		return releases, nil
	}

	branches, err := s.ListBranches()
	if err != nil {
		return []Release{}, nil
	}
	for _, branch := range branches {
		if !strings.HasPrefix(branch, "feature-") {
			continue
		}
		r, err := s.FetchFromBranch(branch)
		if err != nil || len(r) == 0 {
			continue
		}
		return r, nil
	}
	return []Release{}, nil
}

func (s *Service) FetchFromBranch(branch string) ([]Release, error) {
	resp, err := s.get(fmt.Sprintf(s.RawURLTemplate, branch))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return []Release{}, nil
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return Parse(data)
}

func (s *Service) ListBranches() ([]string, error) {
	resp, err := s.get(s.BranchesURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var raw []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	names := make([]string, 0, len(raw))
	for _, b := range raw {
		names = append(names, b.Name)
	}
	return names, nil
}

func (s *Service) SetToken(token string) { s.token = token }

func (s *Service) SetCache(releases []Release, expiry time.Time) {
	s.mu.Lock()
	s.cache = releases
	s.expiry = expiry
	s.mu.Unlock()
}

func (s *Service) GetCache() (releases []Release, expiry time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cache, s.expiry
}

func (s *Service) get(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if s.token != "" {
		req.Header.Set("Authorization", "Bearer "+s.token)
	}
	return s.Client.Do(req)
}

// Parse extracts the first ```yaml block from a markdown document and
// unmarshals it into a slice of Release.
func Parse(data []byte) ([]Release, error) {
	m := yamlBlockRe.FindSubmatch(data)
	if m == nil {
		return []Release{}, nil
	}

	var releases []Release
	if err := yaml.Unmarshal([]byte(strings.TrimSpace(string(m[1]))), &releases); err != nil {
		return nil, err
	}
	return releases, nil
}
