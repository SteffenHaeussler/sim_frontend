# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Local Development:**
- `make dev` - Run Streamlit app locally on port 8501 with debug logging
- `make prod` - Run Streamlit app in production mode
- `uv run streamlit run app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug`

**Docker Development:**
- `make build` - Build Docker image
- `make up` - Start containers with docker compose
- `make down` - Stop containers and remove orphans
- `make all` - Full workflow: down, build, up, test

## Architecture Overview

This is a Streamlit-based frontend that communicates with an external agent API via WebSocket and SSE (Server-Sent Events) connections.

**Core Components:**
- `app.py` - Main WebSocket-based implementation with image support
- `app_sse.py` - SSE-based implementation with image support  
- `app_ws.py` - Basic WebSocket implementation without image parsing

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
The app parses special message format `$%$%Plot:base64data` to extract and display images inline with text responses.