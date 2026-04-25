# Single-image deploy: builds React frontend in stage 1, copies the build into
# the FastAPI image in stage 2, and serves both /api/* (FastAPI) and /* (static
# React) from the same origin. Designed for Render Web Service.

# ---- Stage 1: build the React app ----
FROM node:20-alpine AS frontend
WORKDIR /frontend

# Pull deps first (better cache)
COPY frontend/package.json frontend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

# Build with the public env vars baked in
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

COPY frontend/ ./
RUN yarn build

# ---- Stage 2: FastAPI runtime serving API + static React ----
FROM python:3.11-slim AS runtime
WORKDIR /app

# System deps for lxml + bcrypt + Pillow (and curl for the Render healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libxml2 libxml2-dev libxslt1-dev libjpeg-dev \
        zlib1g-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Backend deps
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Backend code
COPY backend/ /app/backend/

# Drop in the React build under /app/backend/static so FastAPI can mount it
COPY --from=frontend /frontend/build /app/backend/static

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SERVE_STATIC=1

WORKDIR /app/backend
EXPOSE 8001

# Render injects $PORT — fall back to 8001 for local docker run
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}"]
