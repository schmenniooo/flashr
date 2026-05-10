package announcements

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

const (
	rawURLTemplate = "https://raw.githubusercontent.com/schmenniooo/flashr/%s/ANNOUNCEMENTS.md"
	branchesAPIURL = "https://api.github.com/repos/schmenniooo/flashr/branches"
)

var (
	httpClient  = &http.Client{Timeout: 5 * time.Second}
	yamlBlockRe = regexp.MustCompile("(?s)```yaml\n(.*?)```")
)

type Release struct {
	Version     string `yaml:"version" json:"version"`
	Date        string `yaml:"date" json:"date"`
	Title       string `yaml:"title" json:"title"`
	Description string `yaml:"description" json:"description"`
}

func RegisterRoutes(rg *gin.RouterGroup, githubToken string) {
	rg.GET("/announcements", func(c *gin.Context) {
		handle(c, githubToken)
	})
}

func handle(c *gin.Context, token string) {
	releases, err := load(token)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load announcements"})
		return
	}
	c.JSON(http.StatusOK, releases)
}

func load(token string) ([]Release, error) {
	releases, err := fetchFromBranch("main", token)
	if err != nil {
		return nil, err
	}
	if len(releases) > 0 {
		return releases, nil
	}

	// main has no entries yet — try other branches as fallback.
	branches, err := listBranches(token)
	if err != nil {
		return []Release{}, nil
	}
	for _, branch := range branches {
		if branch == "main" {
			continue
		}
		r, err := fetchFromBranch(branch, token)
		if err != nil || len(r) == 0 {
			continue
		}
		return r, nil
	}
	return []Release{}, nil
}

func fetchFromBranch(branch, token string) ([]Release, error) {
	resp, err := get(fmt.Sprintf(rawURLTemplate, branch), token)
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

func listBranches(token string) ([]string, error) {
	resp, err := get(branchesAPIURL, token)
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

func get(url, token string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return httpClient.Do(req)
}
