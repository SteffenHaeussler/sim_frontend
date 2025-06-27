#!/bin/bash

# Run tests with TEST environment
FASTAPI_ENV=TEST python -m pytest tests/ -v "$@"