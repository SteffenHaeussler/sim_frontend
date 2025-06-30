#!/bin/sh

# Load environment variables from .env file
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# SSL Configuration Check
SSL_OPTIONS=""
if [ "$SSL_ENABLED" = "true" ] && [ -n "$SSL_CERT_FILE" ] && [ -n "$SSL_KEY_FILE" ]; then
    SSL_OPTIONS="--ssl-keyfile $SSL_KEY_FILE --ssl-certfile $SSL_CERT_FILE"
    if [ -n "$SSL_CA_CERTS" ]; then
        SSL_OPTIONS="$SSL_OPTIONS --ssl-ca-certs $SSL_CA_CERTS"
    fi
    echo "SSL enabled with cert: $SSL_CERT_FILE"
else
    echo "SSL disabled - running HTTP only"
fi

if [ "$FASTAPI_ENV" = "PROD" ]; then
	uv run uvicorn src.app.main:app --port 5062 --workers 2 --log-level "error" $SSL_OPTIONS
elif [ "$FASTAPI_ENV" = "TEST" ]; then
	uv run python -m pytest --cov-report html --cov=tests
else
	 uv run uvicorn src.app.main:app --host 0.0.0.0 --port 5062 --workers 1 --log-level "debug" $SSL_OPTIONS
fi
