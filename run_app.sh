#!/bin/sh

if [ "$FASTAPI_ENV" = "PROD" ]; then
	uv run uvicorn src.app.main:app --port 5062 --workers 2 --log-level "error"
elif [ "$FASTAPI_ENV" = "TEST" ]; then
	uv run python -m pytest --cov-report html --cov=tests
else
	 uv run uvicorn src.app.main:app --host 0.0.0.0 --port 5062 --workers 1 --log-level "debug"
fi
