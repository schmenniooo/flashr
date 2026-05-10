package announcements

import (
	"net/http"
	"os"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

type Release struct {
	Version     string `yaml:"version" json:"version"`
	Date        string `yaml:"date" json:"date"`
	Title       string `yaml:"title" json:"title"`
	Description string `yaml:"description" json:"description"`
}

var yamlBlockRe = regexp.MustCompile("(?s)```yaml\n(.*?)```")

func RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/announcements", handle)
}

func handle(c *gin.Context) {
	releases, err := load()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load announcements"})
		return
	}
	c.JSON(http.StatusOK, releases)
}

func load() ([]Release, error) {
	// Try repo root first (Railway / Docker run from repo root), then one level up
	// from the backend directory for local `go run ./cmd/server` usage.
	candidates := []string{"ANNOUNCEMENTS.md", "../ANNOUNCEMENTS.md"}
	var data []byte
	var err error
	for _, p := range candidates {
		data, err = os.ReadFile(p)
		if err == nil {
			break
		}
	}
	if err != nil {
		return []Release{}, nil
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
