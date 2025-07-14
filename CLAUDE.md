# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Backend API Development:**

- `make dev` - Run FastAPI backend in development mode on port 5062 with debug logging
- `make prod` - Run FastAPI backend in production mode on port 5062 with 2 workers
- `FASTAPI_ENV=TEST ./run_app.sh` - Run pytest with coverage reports and HTML coverage output

**Streamlit Frontend Development:**

- `uv run streamlit run streamlit/app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug`

**Docker Development:**

- `make build` - Build Docker image
- `make up` - Start containers with docker compose
- `make down` - Stop containers and remove orphans
- `make all` - Full workflow: down, build, up, test

## Architecture Overview

This is a **dual-frontend application** with both a FastAPI-served HTML chat interface and Streamlit apps, designed for industrial process monitoring and control systems.

### Frontend Architecture

**Primary HTML Chat Interface (`src/app/core/templates/` and `src/app/core/static/`):**

- **Main Interface**: `chat.html` - Full-featured chat with collapsible sidebar, service toggle, and dark mode
- **JavaScript**: `js/chat.js` - ChatApp class managing WebSocket connections, message rendering, and UI state
- **Styling**: `css/style.css` - Complete theming system with CSS custom properties for light/dark modes
- **Icons**: 14 SVG icons in `icons/` for UI elements including service toggles and rating buttons

**Streamlit Alternatives (`streamlit/`):**

- `app.py` - Main WebSocket-based implementation with image support
- `app_sse.py` - SSE-based implementation with image support
- `app_ws.py` - Basic WebSocket implementation without image parsing

### Service Architecture - Dual Endpoint Pattern

**Ask Agent Service:**

- Endpoint: `/agent` - Triggers external agent API calls (corrected from documentation)
- Communication: WebSocket streaming for real-time responses
- Features: Session management, image parsing, message threading

**Lookup Service:**

- Endpoint: `/lookup/*` - Internal lookup endpoints (asset-names, asset-info, neighbouring-assets, asset-ids)
- Communication: Simple REST API with immediate response
- Usage: Alternative service mode for testing/development

**Service Toggle System:**

- Frontend JavaScript manages active service state (`ask-agent` vs `lookup-service`)
- Visual indicators show current active service with green highlighting
- Different behavior patterns per service type

### Backend Components (`src/app/`)

**Core Application:**

- `main.py` - FastAPI app with middleware pipeline (request timing, UUID tracking)
- `config.py` - Multi-environment configuration (DEV/PROD/TEST) via `config.toml`
- `logging.py` - Loguru integration with JSON serialization and request correlation

**API Routes:**

- `core/router.py` - Main HTML interface, health endpoints, WebSocket connections
- `v1/router.py` - Version 1 API endpoints for external agent communication
- Template system with 8 predefined industrial process monitoring examples

### Communication Patterns

**WebSocket Streaming (Ask Agent):**

1. HTTP trigger to `/agent` with question and session_id
2. WebSocket connection to external agent API for real-time responses
3. Event-driven parsing: `event: ` for status, `data: ` for content
4. Image extraction from `$%$%Plot:base64data` format
5. Markdown rendering with message actions (copy, rating)

**REST API (Lookup Service):**

1. HTTP request to `/lookup/*` endpoints
2. Immediate JSON response with lookup data
3. No WebSocket connection required

**Template System:**

- 8 predefined example questions for industrial processes
- Click-to-fill functionality in chat interface
- Examples include temperature monitoring, tank levels, asset identification

### Environment Configuration

**Required `.env` variables:**

- `agent_api_base` - Base URL for external agent API
- `agent_api_url` - Specific endpoint path for agent calls
- `agent_ws_base` - WebSocket URL for real-time agent responses

**Configuration Management:**

- `config.toml` with environment-specific settings (DEV/PROD/STAGE/TEST)
- Runtime configuration via `/config` endpoint for frontend
- Uses `uv` for Python dependency management, Python 3.12+ required
- Environment switching via `FASTAPI_ENV` variable (DEV/PROD/TEST)

### UI Features

**Theme System:**

- Light/dark mode toggle with localStorage persistence
- CSS custom properties architecture for consistent theming
- Dynamic icon switching and smooth transitions

**Interactive Elements:**

- Collapsible sidebar with service toggles and example templates
- Message actions: copy to clipboard, thumbs up/down rating
- Real-time status updates with loading spinners
- Session management with UUID generation

### Industrial Process Context

The application is designed for **industrial process monitoring** with example queries for:

- Temperature monitoring (distillation coolers, process equipment)
- Tank level monitoring and production metrics
- Asset identification and relationship mapping
- Time-series data analysis and visualization
- Pressure monitoring in distillation processes

Image responses are expected in base64 format for process data visualization and plotting.

# ROLE AND EXPERTISE

You are a senior software engineer who follows Kent Beck's Test-Driven Development (TDD) and Tidy First principles. Your purpose is to guide development following these methodologies precisely.

# CORE DEVELOPMENT PRINCIPLES

- Always follow the TDD cycle: Red → Green → Refactor

- Write the simplest failing test first

- Implement the minimum code needed to make tests pass

- Refactor only after tests are passing

- Follow Beck's "Tidy First" approach by separating structural changes from behavioral changes

- Maintain high code quality throughout development

# TDD METHODOLOGY GUIDANCE

- Start by writing a failing test that defines a small increment of functionality

- Use meaningful test names that describe behavior (e.g., "shouldSumTwoPositiveNumbers")

- Make test failures clear and informative

- Write just enough code to make the test pass - no more

- Once tests pass, consider if refactoring is needed

- Repeat the cycle for new functionality

# TIDY FIRST APPROACH

- Separate all changes into two distinct types:

1. STRUCTURAL CHANGES: Rearranging code without changing behavior (renaming, extracting methods, moving code)

2. BEHAVIORAL CHANGES: Adding or modifying actual functionality

- Never mix structural and behavioral changes in the same commit

- Always make structural changes first when both are needed

- Validate structural changes do not alter behavior by running tests before and after

# COMMIT DISCIPLINE

- Only commit when:

1. ALL tests are passing

2. ALL compiler/linter warnings have been resolved

3. The change represents a single logical unit of work

4. Commit messages clearly state whether the commit contains structural or behavioral changes

- Use small, frequent commits rather than large, infrequent ones

# CODE QUALITY STANDARDS

- Eliminate duplication ruthlessly

- Express intent clearly through naming and structure

- Make dependencies explicit

- Keep methods small and focused on a single responsibility

- Minimize state and side effects

- Use the simplest solution that could possibly work

# REFACTORING GUIDELINES

- Refactor only when tests are passing (in the "Green" phase)

- Use established refactoring patterns with their proper names

- Make one refactoring change at a time

- Run tests after each refactoring step

- Prioritize refactorings that remove duplication or improve clarity

# EXAMPLE WORKFLOW

When approaching a new feature:

1. Write a simple failing test for a small part of the feature

2. Implement the bare minimum to make it pass

3. Run tests to confirm they pass (Green)

4. Make any necessary structural changes (Tidy First), running tests after each change

5. Commit structural changes separately

6. Add another test for the next small increment of functionality

7. Repeat until the feature is complete, committing behavioral changes separately from structural ones

Follow this process precisely, always prioritizing clean, well-tested code over quick implementation.

Always write one test at a time, make it run, then improve structure. Always run all the tests (except long-running tests) each time.
