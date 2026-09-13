#!/bin/sh
# Validate the draft Procedure and run result-boundary conformance.
# Points procedure-contracts tools at draft files. Does not modify repos/ catalogs.
set -eu
HERE="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ROOT="$HERE"
while [ "$ROOT" != "/" ]; do
  if [ -d "$ROOT/repos/procedure-contracts" ]; then
    break
  fi
  ROOT="$(dirname "$ROOT")"
done
if [ ! -d "$ROOT/repos/procedure-contracts" ]; then
  echo "repos/procedure-contracts not found above $HERE" >&2
  exit 2
fi
CONTRACTS="$ROOT/repos/procedure-contracts"
NODE_BIN="${NODE_BIN:-$ROOT/.tools/node/bin/node}"
NPM_BIN="${NPM_BIN:-$ROOT/.tools/node/bin/npm}"

if [ ! -x "$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
    NPM_BIN="$(command -v npm || true)"
  else
    echo "Node 22+ is required." >&2
    exit 2
  fi
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

if [ ! -d "$CONTRACTS/node_modules/ajv" ]; then
  echo "installing procedure-contracts npm dependencies"
  ( cd "$CONTRACTS" && "$NPM_BIN" ci --ignore-scripts )
fi

echo "== validate draft Profile / Manifest / Suite =="
"$NODE_BIN" "$HERE/procedure/check.mjs"

echo "== result-boundary conformance =="
"$NODE_BIN" "$CONTRACTS/src/run-conformance.mjs" \
  --profile "$HERE/procedure/profile.v0.1.json" \
  --suite "$HERE/procedure/conformance.v0.1.json" \
  --manifest "$HERE/procedure/implementation-manifest.json" \
  --implementation-root "$HERE"

echo "== validate-stage-bindings (File Vitals) =="
"$NODE_BIN" "$CONTRACTS/src/validate-stage-bindings.mjs" \
  --profile "$HERE/procedure/profile.v0.1.json" \
  --suite "$HERE/procedure/conformance.v0.1.json" \
  --manifest "$HERE/procedure/implementation-manifest.json" \
  --capability-manifest "$ROOT/repos/file-vitals/capabilities/provider.json"
