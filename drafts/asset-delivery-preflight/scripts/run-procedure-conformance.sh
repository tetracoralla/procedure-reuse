#!/bin/sh
# Validate the draft Procedure and run result-boundary conformance.
# Does not assume author repos/ or .tools/node.
set -eu
HERE="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CUR="$HERE"
REPO_ROOT=""
while [ "$CUR" != "/" ]; do
  if [ -f "$CUR/deps/pins.json" ]; then
    REPO_ROOT="$CUR"
    break
  fi
  CUR="$(dirname "$CUR")"
done
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/scripts/lib/deps.sh" ]; then
  # shellcheck source=../../../scripts/lib/deps.sh
  . "$REPO_ROOT/scripts/lib/deps.sh"
fi

if [ -n "${NODE_BIN:-}" ]; then
  :
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "Node 22+ is required on PATH (docs/CLEAN_ENV.md). This script does not use author .tools/node unless NODE_BIN points there." >&2
  exit 2
fi
if command -v npm >/dev/null 2>&1; then
  NPM_BIN="$(command -v npm)"
else
  NPM_BIN="${NPM_BIN:-}"
fi

export PATH="$(dirname "$NODE_BIN"):$PATH"

NODE_VERSION="$("$NODE_BIN" -v)"
case "$NODE_VERSION" in
  v22.*|v23.*|v24.*|v2[5-9].*) ;;
  *)
    echo "procedure-contracts requires Node 22+. Found $NODE_VERSION ($NODE_BIN)." >&2
    exit 2
    ;;
esac

if [ ! -x "$HERE/bin/capability-adapter" ]; then
  echo "File Vitals JSONL adapter missing. Build it first:" >&2
  echo "  sh scripts/build-file-vitals.sh --all-drafts" >&2
  exit 2
fi

CONTRACTS="$(resolve_procedure_contracts_src 2>/dev/null || true)"
FILE_VITALS="$(resolve_file_vitals_src 2>/dev/null || true)"
if [ -z "${CONTRACTS:-}" ]; then
  echo "procedure-contracts source not found. Set PROCEDURE_CONTRACTS_SRC or run:" >&2
  echo "  sh scripts/fetch-deps.sh --procedure-contracts" >&2
  exit 2
fi
if [ -z "${FILE_VITALS:-}" ]; then
  echo "File Vitals source not found. Set FILE_VITALS_SRC or run:" >&2
  echo "  sh scripts/fetch-deps.sh --file-vitals" >&2
  exit 2
fi

if [ ! -d "$CONTRACTS/node_modules/ajv" ]; then
  if [ -z "$NPM_BIN" ]; then
    echo "npm is required to install procedure-contracts dependencies." >&2
    exit 2
  fi
  echo "installing procedure-contracts npm dependencies"
  ( cd "$CONTRACTS" && "$NPM_BIN" ci --ignore-scripts )
fi

echo "== validate draft Profile / Manifest / Suite =="
"$NODE_BIN" "$HERE/procedure/check.mjs"

echo "== result-boundary conformance =="
"$NODE_BIN" "$CONTRACTS/src/run-conformance.mjs" \
  --profile "$HERE/procedure/asset-delivery-preflight.v0.1.json" \
  --suite "$HERE/procedure/conformance.v0.1.json" \
  --manifest "$HERE/procedure/implementation-manifest.json" \
  --implementation-root "$HERE"

echo "== validate-stage-bindings (File Vitals) =="
"$NODE_BIN" "$CONTRACTS/src/validate-stage-bindings.mjs" \
  --profile "$HERE/procedure/asset-delivery-preflight.v0.1.json" \
  --suite "$HERE/procedure/conformance.v0.1.json" \
  --manifest "$HERE/procedure/implementation-manifest.json" \
  --capability-manifest "$FILE_VITALS/capabilities/provider.json"
