# sim-frontend

`sim-frontend` is a Python-based web application providing both a backend API built with FastAPI and a frontend user interface using Streamlit.

## Overview

The application serves as a frontend interface and API for functionalities including user authentication, data lookup (assets), rating systems, and semantic search capabilities. It is designed to interact with other backend services, including a semantic search engine and potentially an agent-based system.

## Features

*   **FastAPI Backend:**
    *   User authentication (JWT-based) with email and password.
    *   Password reset functionality via email.
    *   API endpoints for core application logic, including:
        *   Loading and accessing "lookup assets".
        *   Submitting and retrieving ratings.
        *   Interacting with a semantic search service for embedding, searching, and ranking.
    *   Health checks and application metadata.
    *   **Request Tracking System:** Comprehensive tracking using three types of IDs:
        *   `session_id` - Tracks user sessions across multiple requests
        *   `event_id` - Tracks specific events (AI responses, ratings)
        *   `request_id` - Tracks individual API requests
*   **Streamlit Frontend:**
    *   User interface for interacting with the application's features (details to be expanded based on Streamlit app specifics).
*   **Database Integration:**
    *   Uses PostgreSQL as its database.
    *   SQLAlchemy ORM with `asyncpg` for asynchronous database operations.
    *   Alembic for database migrations (implied by dependency, though not explicitly seen in file list).
*   **Configuration:**
    *   Environment variable-driven configuration for flexibility across different environments (development, production).
*   **Containerization:**
    *   Dockerized for consistent deployment and development environments.
    *   `compose.yaml` provided for easy local setup using Docker Compose.

## Technologies Used

*   **Backend:** Python, FastAPI, Uvicorn
*   **Frontend:** Streamlit
*   **Database:** PostgreSQL, SQLAlchemy, asyncpg
*   **Authentication:** JWT (python-jose)
*   **Configuration:** Pydantic, python-dotenv
*   **Containerization:** Docker, Docker Compose
*   **Dependency Management & Build:** uv (from Astral)
*   **Logging:** Loguru

## Getting Started

### Prerequisites

*   Docker and Docker Compose installed on your system.
*   Git (for cloning the repository).
*   A `.env` file configured with the necessary environment variables (see [Configuration](#configuration) section).

### Installation & Running Locally (Docker)

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd sim-frontend
    ```

2.  **Create and configure your `.env` file:**
    Based on the required variables in `src/app/config.py`, create a `.env` file in the project root. Key variables include:
    *   `FASTAPI_ENV`
    *   `VERSION`
    *   `DEBUG`
    *   `CONFIG_NAME`
    *   `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRATION_HOURS`
    *   `DB_USER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `PGPASSWORD`
    *   `agent_ws_base`, `agent_url`, `agent_base`
    *   `api_base`, `api_asset_url`, etc.
    *   `semantic_base`, `semantic_emb_url`, etc.
    *   `smtp_host`, `smtp_port`, `sender_email`, `app_password` (if email features are used)
    *   `organisation_name`

3.  **Build and run using Docker Compose:**
    ```bash
    docker-compose up --build
    ```
    This will build the Docker image and start the `sim_frontend` service.

4.  **Access the application:**
    *   The FastAPI application (API) will likely be accessible at `http://localhost:<API_PORT>` (the specific port depends on Uvicorn configuration within `entrypoint.sh`, typically 8000 or as defined in `.env`).
    *   The Streamlit frontend will be accessible at `http://localhost:8501` (as per `compose.yaml`).

### Running Natively (Manual Setup - More Advanced)

Refer to `pyproject.toml` for dependencies. You would typically:
1.  Create a virtual environment.
2.  Install dependencies using `uv`: `uv sync`.
3.  Set up a PostgreSQL database and configure environment variables.
4.  Run database migrations (if Alembic is used).
5.  Start the FastAPI app using Uvicorn: `uvicorn src.app.main:app --reload` (for development).
6.  Run the Streamlit app: `streamlit run streamlit/app.py`.

## Configuration

The application is configured via environment variables. These are loaded from a `.env` file in the project root during development. See `src/app/config.py` for a comprehensive list of required and optional variables.

Key configuration areas:
*   Application settings (environment, debug mode, version)
*   JWT settings
*   Database connection details
*   External API endpoints (agent, asset, semantic search)
*   Email (SMTP) server settings

## Running Tests

The project uses `pytest` for Python tests and `vitest` for JavaScript tests.

### Quick Start

Run all tests (Python + JavaScript):
```bash
make test
```

Run tests with coverage reports:
```bash
make coverage
```

### Detailed Test Options

Use the `run_tests.sh` script for more control:

```bash
# Run all tests (default)
./run_tests.sh

# Run only Python tests
./run_tests.sh -p

# Run only JavaScript tests
./run_tests.sh -j

# Run tests with coverage reports
./run_tests.sh -c

# Run JavaScript tests in watch mode
./run_tests.sh -j -w

# Run tests with verbose output
./run_tests.sh -v

# Show help
./run_tests.sh -h
```

### Test Coverage

*   **Python:** 61 tests covering authentication, endpoints, sessions, and WebSocket functionality (63% code coverage)
*   **JavaScript:** 85 tests covering frontend services including auth, form validation, asset search, and agent interaction

Coverage reports are generated in:
*   **Python:** `htmlcov_python/index.html`
*   **JavaScript:** `coverage/index.html`

### JavaScript Test Setup

The JavaScript tests use:
*   **Vitest** - Fast unit test framework
*   **JSDOM** - DOM simulation for browser APIs
*   **Coverage** - Built-in coverage reporting

To run JavaScript tests directly:
```bash
npm test              # Run once
npm test -- --watch   # Watch mode
npm run coverage      # With coverage report
```

## Project Structure

*   `src/app/`: Main application code.
    *   `main.py`: FastAPI application entry point.
    *   `auth/`: Authentication-related modules.
    *   `core/`: Core API routes, static files, templates.
    *   `config.py`: Configuration management.
    *   `data/`: Static data files (e.g., `lookup_asset.json`).
    *   `models/`: SQLAlchemy database models.
    *   `ratings/`: Ratings-related API modules.
    *   `services/`: Business logic services.
    *   `middleware/`: Custom FastAPI middleware.
*   `streamlit/`: Streamlit application code.
*   `tests/`: Automated tests.
*   `Dockerfile`: Instructions for building the application's Docker image.
*   `compose.yaml`: Docker Compose configuration for local development.
*   `pyproject.toml`: Project metadata and dependencies.
*   `.env` (not committed): Local environment variable configuration.
*   `entrypoint.sh`: Script executed when the Docker container starts.

## Request Tracking System

The application implements a comprehensive request tracking system using HTTP headers for consistent identification and correlation across all API calls.

### Tracking Headers

All API requests include the following tracking headers:

*   **`X-Session-ID`** - Unique identifier for user sessions
    *   Generated once per browser session
    *   Used for session-level analytics and logging correlation
    *   Persists across multiple requests and page reloads

*   **`X-Event-ID`** - Unique identifier for specific events
    *   Generated for AI responses, ratings, and semantic searches
    *   Links user interactions to specific system responses
    *   Essential for rating correlation and feedback tracking

*   **`X-Request-ID`** - Unique identifier for individual requests
    *   Generated per API call for request-level tracking
    *   Enables detailed performance monitoring and debugging
    *   Helps correlate logs across microservices

### Implementation Details

**Backend Processing:**
*   Middleware automatically extracts tracking headers from all incoming requests
*   Falls back to query parameters for backward compatibility
*   Sets tracking IDs in logging context for correlation
*   Enhanced logging includes all tracking IDs in every log message
*   Stores all tracking data in the database for analytics

**Frontend Integration:**
*   JavaScript automatically generates and includes tracking headers
*   Session ID persists across browser session
*   Event IDs link user actions to system responses
*   Request IDs provide detailed API call tracking

**Database Storage:**
*   All tracking IDs are stored in the `api_usage_logs` table
*   Enables comprehensive usage analytics and debugging
*   Links ratings to specific events via event_id correlation

### WebSocket Connections

WebSocket connections use query parameters for session tracking due to browser limitations with custom headers:
```javascript
const wsUrl = `${wsBase}?session_id=${sessionId}`;
```

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

### Automated Checks

Every pull request triggers:
- **Linting** - Ruff checks for code style and formatting
- **Python Tests** - 61 tests with coverage reporting
- **JavaScript Tests** - 85 tests with coverage reporting
- **Security Scan** - Trivy vulnerability scanner
- **Docker Build** - Ensures the application builds correctly

### Branch Protection

The repository should have branch protection rules configured for `main` and `develop` branches. See [.github/BRANCH_PROTECTION.md](.github/BRANCH_PROTECTION.md) for recommended settings.

### Workflows

- **CI** (`.github/workflows/ci.yml`) - Runs on every push and PR
- **Dependency Review** (`.github/workflows/dependency-review.yml`) - Checks for vulnerable dependencies
- **Release** (`.github/workflows/release.yml`) - Automated releases on version tags
- **Dependabot** (`.github/dependabot.yml`) - Automated dependency updates

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for details on contributions (if this file exists).

When submitting a pull request:
1. Ensure all tests pass locally: `make test`
2. Run linting: `uv run ruff check .` and `uv run ruff format .`
3. Update tests if adding new features
4. Follow the PR template

### Setting Up Pre-commit Hooks (Recommended)

To automatically run linting and formatting before each commit:

```bash
# Install pre-commit
uv pip install pre-commit

# Install the git hook scripts
pre-commit install

# (Optional) Run against all files
pre-commit run --all-files
```

## License

Refer to the `LICENSE.md` file for licensing information (if this file exists).
