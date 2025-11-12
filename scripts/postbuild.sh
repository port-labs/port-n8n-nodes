#!/usr/bin/env bash
set -euo pipefail

echo "Formatting code..."
pnpm format

echo "Linting code..."
pnpm lint

echo "Generating plugin package for distribution..."
node ./scripts/generate_package.js