export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

all: down build up test

dev:
	uv run streamlit run app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug
prod:
	uv run streamlit run app.py --server.port=8501 --server.address=0.0.0.0 --logger.level=debug
DEV: dev
PROD:prod


build:
	docker compose build

up:
	docker compose up

down:
	docker compose down --remove-orphans
