# syntax=docker/dockerfile:1.7

FROM ollama/ollama:latest

ENV OLLAMA_MODEL=llama3.2:3b

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 11434
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
