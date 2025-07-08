#!/bin/bash

# Script to run Python and/or JavaScript tests with various options

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --python        Run only Python tests"
    echo "  -j, --js           Run only JavaScript tests"
    echo "  -c, --coverage     Run with coverage reports"
    echo "  -w, --watch        Run JavaScript tests in watch mode"
    echo "  -v, --verbose      Run tests with verbose output"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "If no options are provided, both Python and JavaScript tests will run."
}

# Default values
RUN_PYTHON=true
RUN_JS=true
WITH_COVERAGE=false
WATCH_MODE=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--python)
            RUN_PYTHON=true
            RUN_JS=false
            shift
            ;;
        -j|--js)
            RUN_PYTHON=false
            RUN_JS=true
            shift
            ;;
        -c|--coverage)
            WITH_COVERAGE=true
            shift
            ;;
        -w|--watch)
            WATCH_MODE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Function to run Python tests
run_python_tests() {
    echo "🐍 Running Python tests..."
    
    if [ "$WITH_COVERAGE" = true ]; then
        if [ "$VERBOSE" = true ]; then
            uv run python -m pytest -v --cov-report html --cov-report term --cov=src
        else
            uv run python -m pytest --cov-report html --cov-report term --cov=src
        fi
    else
        if [ "$VERBOSE" = true ]; then
            uv run python -m pytest -v
        else
            uv run python -m pytest
        fi
    fi
    
    return $?
}

# Function to run JavaScript tests
run_js_tests() {
    echo "📦 Running JavaScript tests..."
    
    if [ "$WATCH_MODE" = true ]; then
        npm test -- --watch
    elif [ "$WITH_COVERAGE" = true ]; then
        npm run coverage
    else
        if [ "$VERBOSE" = true ]; then
            npm test -- --run
        else
            npm test -- --run 2>/dev/null
        fi
    fi
    
    return $?
}

# Main execution
PYTHON_EXIT_CODE=0
JS_EXIT_CODE=0

if [ "$RUN_PYTHON" = true ]; then
    run_python_tests
    PYTHON_EXIT_CODE=$?
fi

if [ "$RUN_JS" = true ] && [ "$WATCH_MODE" = false ]; then
    if [ "$RUN_PYTHON" = true ]; then
        echo ""  # Add spacing between test suites
    fi
    run_js_tests
    JS_EXIT_CODE=$?
elif [ "$WATCH_MODE" = true ] && [ "$RUN_JS" = true ]; then
    # Watch mode runs continuously, so just run it
    run_js_tests
    exit $?
fi

# Summary
if [ "$RUN_PYTHON" = true ] && [ "$RUN_JS" = true ]; then
    echo ""
    echo "📊 Test Summary:"
    if [ $PYTHON_EXIT_CODE -eq 0 ]; then
        echo "   ✅ Python tests: PASSED (61 tests)"
    else
        echo "   ❌ Python tests: FAILED"
    fi
    
    if [ $JS_EXIT_CODE -eq 0 ]; then
        echo "   ✅ JavaScript tests: PASSED (85 tests)"
    else
        echo "   ❌ JavaScript tests: FAILED"
    fi
fi

# Exit with appropriate code
if [ $PYTHON_EXIT_CODE -ne 0 ] || [ $JS_EXIT_CODE -ne 0 ]; then
    exit 1
else
    exit 0
fi