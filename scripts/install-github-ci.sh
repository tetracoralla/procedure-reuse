#!/bin/sh
# Copy the CI workflow into .github/workflows/. Creating that path on GitHub
# requires a token with the `workflow` scope.
set -eu
HERE="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ROOT="$(CDPATH= cd -- "$HERE/.." && pwd)"
mkdir -p "$ROOT/.github/workflows"
cp "$ROOT/docs/ci.github.yml" "$ROOT/.github/workflows/ci.yml"
echo "wrote $ROOT/.github/workflows/ci.yml"
echo "Commit and push with a token that has the workflow scope:"
echo "  git add .github/workflows/ci.yml"
echo "  git commit -m \"Install GitHub Actions workflow.\""
echo "  git push origin HEAD"
