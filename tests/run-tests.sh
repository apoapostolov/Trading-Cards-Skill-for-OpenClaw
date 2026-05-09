#!/bin/bash
# Trading Cards Skill Test Runner

set -e

SKILL_DIR="${HOME}/.hermes/skills/gaming/trading-cards"
TEST_DIR="${SKILL_DIR}/tests"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Trading Cards Skill - Test Suite                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Track results
SMOKE_PASSED=0
REGRESSION_PASSED=0

# Run smoke tests
echo "Running smoke tests..."
echo ""
if node "${TEST_DIR}/smoke-test.js"; then
    SMOKE_PASSED=1
else
    SMOKE_PASSED=0
fi

echo ""
echo "Running regression tests..."
echo ""
if node "${TEST_DIR}/regression-test.js"; then
    REGRESSION_PASSED=1
else
    REGRESSION_PASSED=0
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Test Summary                                             ║"
echo "╠════════════════════════════════════════════════════════════╣"

if [ $SMOKE_PASSED -eq 1 ]; then
    echo "║   Smoke Tests:      ✓ PASSED                               ║"
else
    echo "║   Smoke Tests:      ✗ FAILED                               ║"
fi

if [ $REGRESSION_PASSED -eq 1 ]; then
    echo "║   Regression Tests: ✓ PASSED                               ║"
else
    echo "║   Regression Tests: ✗ FAILED                               ║"
fi

echo "╚════════════════════════════════════════════════════════════╝"
echo ""

if [ $SMOKE_PASSED -eq 1 ] && [ $REGRESSION_PASSED -eq 1 ]; then
    echo "All tests passed! ✓"
    exit 0
else
    echo "Some tests failed. ✗"
    exit 1
fi
