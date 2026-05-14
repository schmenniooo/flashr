// Package storage wraps an S3-compatible bucket (Railway Buckets, MinIO, etc.).
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Client wraps a single S3-compatible bucket.
type Client struct {
	s3     *s3.Client
	bucket string
}

// New creates a Client pointed at an S3-compatible endpoint.
// endpoint must be the full base URL, e.g. "https://bucket.up.railway.app".
// UsePathStyle is forced on because non-AWS stores require it.
func New(endpoint, accessKeyID, secretAccessKey, bucket string) *Client {
	cfg := aws.Config{
		Region:      "auto", // Railway Buckets don't use real AWS regions
		Credentials: credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})
	return &Client{s3: client, bucket: bucket}
}

// Put uploads data at key with the given MIME content type.
func (c *Client) Put(ctx context.Context, key string, data []byte, contentType string) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("storage put %q: %w", key, err)
	}
	return nil
}

// Get downloads the object at key and returns its raw bytes.
func (c *Client) Get(ctx context.Context, key string) ([]byte, error) {
	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("storage get %q: %w", key, err)
	}
	defer out.Body.Close()
	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, fmt.Errorf("storage read %q: %w", key, err)
	}
	return data, nil
}

// Delete removes the object at key. It is a no-op if the key does not exist.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("storage delete %q: %w", key, err)
	}
	return nil
}

// Ping verifies the bucket is reachable by issuing a cheap HeadBucket call.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.s3.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(c.bucket),
	})
	if err != nil {
		return fmt.Errorf("storage ping: %w", err)
	}
	return nil
}

// MustDelete calls Delete and logs a warning on failure instead of propagating
// the error. Intended for deferred cleanup where the caller cannot act on errors.
func (c *Client) MustDelete(ctx context.Context, key string) {
	if err := c.Delete(ctx, key); err != nil {
		slog.Warn("storage cleanup failed", "key", key, "error", err)
	}
}
