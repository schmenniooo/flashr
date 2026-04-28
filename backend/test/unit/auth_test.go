package unit_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/smithlabs/flashr/backend/internal/auth"
)

func TestNewService_NilPool(t *testing.T) {
	_, err := auth.NewService(nil, auth.Config{Secret: "a-secret-that-is-at-least-32-bytes!"})
	assert.ErrorContains(t, err, "nil db pool")
}
