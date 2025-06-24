export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

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
