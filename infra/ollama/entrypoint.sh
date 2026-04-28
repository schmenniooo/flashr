#!/bin/sh
set -e

: "${OLLAMA_MODEL:?OLLAMA_MODEL must be set (e.g. llama3.2:3b)}"

# Start the Ollama server in the background.
ollama serve &
SERVER_PID=$!

# Wait until the server's HTTP API is responding.
echo "ollama: waiting for server to start..."
until ollama list >/dev/null 2>&1; do
    sleep 1
done

# Ensure the configured model is present (idempotent — skips download if up-to-date).
echo "ollama: ensuring model '$OLLAMA_MODEL' is present..."
ollama pull "$OLLAMA_MODEL"
echo "ollama: model '$OLLAMA_MODEL' ready"

# Hand control back to the long-running server process.
wait "$SERVER_PID"
