#!/bin/sh
# Validate the draft Procedure and run result-boundary conformance.
# Points procedure-contracts tools at draft files. Does not modify repos/ catalogs.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
DRAFT="$ROOT/drafts/asset-delivery-preflight"
CONTRACTS="$ROOT/repos/procedure-contracts"
NODE_BIN="${NODE_BIN:-$ROOT/.tools/node/bin/node}"
NPM_BIN="${NPM_BIN:-$ROOT/.tools/node/bin/npm}"

if [ ! -x "$NODE_BIN" ]; then
  sh "$DRAFT/scripts/ensure-node.sh"
  NODE_BIN="$ROOT/.tools/node/bin/node"
  NPM_BIN="$ROOT/.tools/node/bin/npm"
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

if [ ! -x "$DRAFT/bin/capability-adapter" ]; then
  echo "File Vitals JSONL adapter missing. Build it first:" >&2
  echo "  $DRAFT/scripts/build-file-vitals.sh" >&2
  exit 2
fi

if [ ! -d "$CONTRACTS/node_modules/ajv" ]; then
  echo "installing procedure-contracts npm dependencies"
  ( cd "$CONTRACTS" && "$NPM_BIN" ci --ignore-scripts )
fi

echo "== validate draft Profile / Manifest / Suite =="
"$NODE_BIN" "$DRAFT/procedure/check.mjs"

echo "== result-boundary conformance =="
"$NODE_BIN" "$CONTRACTS/src/run-conformance.mjs" \
  --profile "$DRAFT/procedure/asset-delivery-preflight.v0.1.json" \
  --suite "$DRAFT/procedure/conformance.v0.1.json" \
  --manifest "$DRAFT/procedure/implementation-manifest.json" \
  --implementation-root "$DRAFT"

echo "== validate-stage-bindings (File Vitals) =="
"$NODE_BIN" "$CONTRACTS/src/validate-stage-bindings.mjs" \
  --profile "$DRAFT/procedure/asset-delivery-preflight.v0.1.json" \
  --suite "$DRAFT/procedure/conformance.v0.1.json" \
  --manifest "$DRAFT/procedure/implementation-manifest.json" \
  --capability-manifest "$ROOT/repos/file-vitals/capabilities/provider.json"
