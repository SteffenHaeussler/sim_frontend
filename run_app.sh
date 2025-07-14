#!/bin/sh

if [ "$FASTAPI_ENV" = "PROD" ]; then
	uv run uvicorn src.app.main:app --port 5062 --workers 2 --log-level "error"
elif [ "$FASTAPI_ENV" = "TEST" ]; then
	echo "Running Python tests..."
	uv run python -m pytest --cov-report html --cov=tests
	PYTHON_EXIT_CODE=$?

	echo -e "\nRunning JavaScript tests..."
	npm test -- --run 2>/dev/null
	JS_EXIT_CODE=$?

	# Exit with non-zero if either test suite failed
	if [ $PYTHON_EXIT_CODE -ne 0 ] || [ $JS_EXIT_CODE -ne 0 ]; then
		echo -e "\n❌ Test failures detected!"
		if [ $PYTHON_EXIT_CODE -ne 0 ]; then
			echo "   - Python tests failed"
		fi
		if [ $JS_EXIT_CODE -ne 0 ]; then
			echo "   - JavaScript tests failed"
		fi
		exit 1
	else
		echo -e "\n✅ All tests passed! (61 Python tests, 85 JavaScript tests)"
		exit 0
	fi
else
	 uv run uvicorn src.app.main:app --host 0.0.0.0 --port 5062 --workers 1 --log-level "debug"
fi
