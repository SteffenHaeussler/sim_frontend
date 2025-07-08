export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

.PHONY: all build up down dev prod test coverage

all: down build up test

# dev:
# 	uv run streamlit run streamlit/app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug
# prod:
# 	uv run streamlit run streamlit/app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug
# dev:
# 	uv run python -m uvicorn src.app.main:app --host 0.0.0.0 --port 5061 --workers 1 --log-level debug
# prod:
# 	uv run python -m uvicorn src.app.main:app --host 0.0.0.0 --port 5061 --workers 2 --log-level error

DEV: dev
PROD:prod


build:
	docker compose build

up:
	docker compose up

down:
	docker compose down --remove-orphans


dev:
	FASTAPI_ENV=DEV ./run_app.sh


prod:
	FASTAPI_ENV=PROD ./run_app.sh

test:
	FASTAPI_ENV=TEST ./run_app.sh

coverage:
	@echo "🧪 Running tests with coverage reports..."
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "🐍 Python Coverage Report"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@uv run python -m pytest --cov-report term --cov-report html:htmlcov_python --cov=src -q
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📦 JavaScript Coverage Report"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@npm run coverage 2>/dev/null
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "📊 Coverage Summary"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "✅ Python coverage report: htmlcov_python/index.html"
	@echo "✅ JavaScript coverage report: coverage/index.html"
	@echo ""
	@echo "To view reports:"
	@echo "  Python:     open htmlcov_python/index.html"
	@echo "  JavaScript: open coverage/index.html"
