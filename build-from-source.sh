#!/usr/bin/env bash
# Build the public Trading-Cards-Skill-for-OpenClaw repo from a local Hermes source.
# Strips all personal player data, hermes-agent symlink, and backup files.
# Usage: bash build-from-source.sh [source-dir]
# Default source: $HOME/.hermes/skills/gaming/trading-cards

set -euo pipefail

SRC="${1:-$HOME/.hermes/skills/gaming/trading-cards}"
DST="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building public repo ==="
echo "Source: $SRC"
echo "Dest:   $DST"

# Clean dest (except .git/)
cd "$DST"
find . -not -path './.git/*' -not -name '.git' -delete

# Copy scripts
cp -r "$SRC/scripts" .
rm -rf scripts/node_modules
rm -f scripts/card-engine.js.orig.8353

# Copy references
cp -r "$SRC/references" .

# Copy root files
cp "$SRC/SKILL.md" .
cp "$SRC/package.json" .
cp "$SRC/package-lock.json" .

# Copy tests
cp -r "$SRC/tests" .

# Copy images
cp -r "$SRC/img" . 2>/dev/null || true

# Build data/ — seeded data only, no player data
mkdir -p data/sets data/stores data/scalpers data/orderbook data/grading

[ -d "$SRC/data/sets" ]     && cp "$SRC/data/sets/"*.json data/sets/ 2>/dev/null || true
[ -d "$SRC/data/stores" ]   && cp "$SRC/data/stores/"*.json data/stores/ 2>/dev/null || true
[ -d "$SRC/data/scalpers" ] && cp "$SRC/data/scalpers/"*.json data/scalpers/ 2>/dev/null || true
[ -d "$SRC/data/orderbook" ] && cp "$SRC/data/orderbook/"*.json data/orderbook/ 2>/dev/null || true
[ -d "$SRC/data/grading" ]  && cp "$SRC/data/grading/"*.json data/grading/ 2>/dev/null || true
[ -f "$SRC/data/market-macro.json" ] && cp "$SRC/data/market-macro.json" data/ || true
[ -f "$SRC/data/pack-config.json" ] && cp "$SRC/data/pack-config.json" data/ || true
[ -f "$SRC/data/grading-population.json" ] && cp "$SRC/data/grading-population.json" data/ || true

echo ""
echo "=== Files in dest ==="
find . -not -path './.git/*' -type f | sort
echo ""
echo "Done. Review changes and commit."
