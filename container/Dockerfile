# syntax=docker/dockerfile:1
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (cache-friendly)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --all-extras

# Copy application code
COPY . .

EXPOSE 8080
CMD [".venv/bin/python", "main.py"]
