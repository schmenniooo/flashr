# syntax=docker/dockerfile:1.7

FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV VITE_HOST=0.0.0.0 \
    VITE_PORT=5173

EXPOSE 5173
CMD ["sh", "-c", "npm run dev -- --host \"$VITE_HOST\" --port \"$VITE_PORT\""]
