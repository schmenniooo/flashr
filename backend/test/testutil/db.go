//go:build integration

package testutil

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/smithlabs/flashr/backend/pkg/db"
)

// SetupDB starts a temporary Postgres container, runs all migrations, and
// returns a pool plus a cleanup function. Intended for use in TestMain.
func SetupDB() (*pgxpool.Pool, func(), error) {
	ctx := context.Background()

	pgContainer, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("flashr_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("start postgres: %w", err)
	}

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		return nil, nil, fmt.Errorf("connection string: %w", err)
	}

	pool, err := db.Connect(ctx, connStr)
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		return nil, nil, fmt.Errorf("connect: %w", err)
	}

	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		_ = pgContainer.Terminate(ctx)
		return nil, nil, fmt.Errorf("migrate: %w", err)
	}

	cleanup := func() {
		pool.Close()
		_ = pgContainer.Terminate(context.Background())
	}
	return pool, cleanup, nil
}

// Truncate clears all user-facing tables. Call at the start of each test to
// ensure a clean state when tests share a single container.
func Truncate(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		"TRUNCATE users, collections, cards, upload_jobs CASCADE")
	if err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}
