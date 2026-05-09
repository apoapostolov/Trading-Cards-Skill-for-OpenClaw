# Trading Cards Skill Tests

Test suite for the Hermes trading-cards skill.

## Test Files

| File | Purpose |
|------|---------|
| `smoke-test.js` | Quick validation of core functionality (~30s) |
| `regression-test.js` | Comprehensive edge case and bug fix tests (~60s) |
| `run-tests.sh` | Run all tests with summary |

## Running Tests

### Individual test suites:

```bash
# Smoke tests (quick sanity check)
node ~/.hermes/skills/gaming/trading-cards/tests/smoke-test.js

# Regression tests (thorough validation)
node ~/.hermes/skills/gaming/trading-cards/tests/regression-test.js
```

### All tests:

```bash
bash ~/.hermes/skills/gaming/trading-cards/tests/run-tests.sh
```

## What Tests Cover

### Smoke Tests
- Player registration and switching
- Wallet operations (add/remove/set)
- Procedural set generation
- Pack opening (dry-run and real)
- Portfolio view
- Duplicate detection
- Flopps commands
- Market commands

### Regression Tests
- Missing active set handling (should not auto-create)
- Explicit generation creates proper state
- Stipend sweep (missed days)
- Stipend for all players
- Flopps wildcard with fixtures
- Flopps status/day commands
- Category-specific generation (sports, etc.)
- Wallet insufficient funds checks
- Card grading
- History logging
- Card selling

## Test Environment

Tests use isolated temporary directories and do NOT touch:
- `~/.openclaw/workspace/skills/trading-cards/data/`
- `~/.hermes/skills/gaming/trading-cards/data/`

All data is created in `os.tmpdir()` and cleaned up automatically.

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed
