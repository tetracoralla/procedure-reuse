#!/bin/sh
# Minimum checks a clean clone can run from this commit.
# Does not use author bin/, .tools/, dist/, or a historical session.
set -eu

HERE="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$HERE/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=lib/deps.sh
. "$HERE/lib/deps.sh"

NODE_ONLY=0
WITH_FV=0
FETCH=0

usage() {
  cat <<'EOF'
Usage: scripts/verify-clean.sh [--node-only] [--with-file-vitals] [--fetch]

  --node-only          node --test on key drafts; adapter-backed cases skip
  --with-file-vitals   require a built adapter; do not skip those cases
  --fetch              git clone the pinned File Vitals commit first

Default is --node-only.

After Skill or combinator source changes, rebuild any sealed pack before
treating dist/*.tar.gz as evidence. This script never reads gitignored dist/.
EOF
}

if [ "$#" -eq 0 ]; then
  NODE_ONLY=1
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --node-only) NODE_ONLY=1; shift ;;
    --with-file-vitals) WITH_FV=1; shift ;;
    --fetch) FETCH=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

NODE_BIN="$(require_node)"
NODE_VERSION="$("$NODE_BIN" -v)"
echo "node $NODE_VERSION ($NODE_BIN)"
echo "cwd $REPO_ROOT"

fail_hardcoded() {
  echo "clean-env guard failed: $1" >&2
  exit 2
}

if grep -F -n 'repos/agent-tool-development-kit' \
  drafts/devkit-compose-scaffold/src/init.mjs \
  drafts/devkit-compose-scaffold/src/project-document.mjs >/dev/null; then
  fail_hardcoded "compose scaffold still imports author Kit checkout"
fi

if grep -E -n 'SRC="\$ROOT/repos/file-vitals"|\$ROOT/repos/file-vitals' \
  scripts/build-file-vitals.sh >/dev/null; then
  fail_hardcoded "root build-file-vitals.sh still hardcodes repos/file-vitals"
fi

if [ -d dist ] || ls drafts/*/dist/*.tar.gz >/dev/null 2>&1; then
  echo "note: gitignored dist/ is present and is not evidence for this run."
  echo "      Rebuild the sealed pack after Skill or source changes (docs/CLEAN_ENV.md)."
fi

if [ "$FETCH" -eq 1 ]; then
  sh "$HERE/fetch-deps.sh" --file-vitals
fi

if [ "$WITH_FV" -eq 1 ]; then
  export REQUIRE_FILE_VITALS=1
  if [ -z "${FILE_VITALS_ADAPTER:-}" ]; then
    ADAPTER="$REPO_ROOT/drafts/asset-delivery-preflight/bin/capability-adapter"
    if [ ! -x "$ADAPTER" ]; then
      echo "adapter missing; building from the pinned File Vitals source" >&2
      sh "$HERE/build-file-vitals.sh" --all-drafts
    fi
    if [ ! -x "$ADAPTER" ]; then
      echo "File Vitals adapter still missing at $ADAPTER" >&2
      exit 2
    fi
  fi
fi

echo "== generate (png + write bounds; adapter cases skip without a binary) =="
"$NODE_BIN" --test \
  drafts/asset-delivery-generate/src/png.test.mjs \
  drafts/asset-delivery-generate/src/generate.test.mjs

echo "== asset-delivery-preflight =="
"$NODE_BIN" --test \
  drafts/asset-delivery-preflight/preflight.test.mjs \
  drafts/asset-delivery-preflight/src/mcp-server.test.mjs

echo "== channel-cover-preflight =="
"$NODE_BIN" --test \
  drafts/channel-cover-preflight/src/preflight.test.mjs \
  drafts/channel-cover-preflight/src/mcp-server.test.mjs

echo "== batch-delivery-preflight =="
"$NODE_BIN" --test \
  drafts/batch-delivery-preflight/src/preflight.test.mjs \
  drafts/batch-delivery-preflight/src/mcp-server.test.mjs \
  drafts/batch-delivery-preflight/src/procedure-adapter.test.mjs \
  drafts/batch-delivery-preflight/src/lower.test.mjs

echo "== compose-scaffold init (no Kit checkout) =="
"$NODE_BIN" --test drafts/devkit-compose-scaffold/test/init.test.mjs

echo "verify-clean ok (node-only=$NODE_ONLY with-file-vitals=$WITH_FV)"
