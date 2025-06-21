# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Backend API Development:**
- `make dev` - Run FastAPI backend in development mode on port 5055 with debug logging
- `make prod` - Run FastAPI backend in production mode with 2 workers
- `uv run python -m uvicorn src.app.main:app --host 0.0.0.0 --port 5055 --workers 1 --log-level debug`

**Streamlit Frontend Development:**
- `uv run streamlit run streamlit/app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug`

**Docker Development:**
- `make build` - Build Docker image
- `make up` - Start containers with docker compose
- `make down` - Stop containers and remove orphans
- `make all` - Full workflow: down, build, up, test

## Architecture Overview

This is a dual-component application with both a FastAPI backend and Streamlit frontend that communicates with external agent APIs.

**Backend Components (`src/app/`):**
- `main.py` - FastAPI application entry point with middleware and routing
- `core/` - Core API functionality and routing
- `v1/` - Version 1 API endpoints
- `config.py` - Application configuration management
- `logging.py` - Logging setup and configuration

**Frontend Components (`streamlit/`):**
- `app.py` - Main WebSocket-based Streamlit app with image support
- `app_sse.py` - SSE-based Streamlit implementation with image support  
- `app_ws.py` - Basic WebSocket Streamlit implementation without image parsing

**Communication Flow:**
1. User enters question in Streamlit UI
2. Trigger HTTP GET request to agent API with session_id and question
3. Listen for real-time responses via WebSocket or SSE
4. Parse and display text responses and base64 images (formatted as `$%$%Plot:base64data`)

**Environment Configuration:**
- Requires `.env` file with `agent_api_base`, `agent_api_url`, and `agent_ws_base`
- Uses `uv` for Python dependency management
- Python 3.12+ required

**Image Handling:**
The Streamlit apps parse special message format `$%$%Plot:base64data` to extract and display images inline with text responses.