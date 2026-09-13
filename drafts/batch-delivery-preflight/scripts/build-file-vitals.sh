#!/bin/sh
# Build File Vitals CLI + JSONL adapter into this project's bin/.
# Does not modify repos/file-vitals sources. Reuses an already-built sibling
# adapter when present.
set -eu
HERE="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
# Walk up to the workspace that contains repos/file-vitals.
ROOT="$HERE"
while [ "$ROOT" != "/" ]; do
  if [ -d "$ROOT/repos/file-vitals" ]; then
    break
  fi
  ROOT="$(dirname "$ROOT")"
done
if [ ! -d "$ROOT/repos/file-vitals" ]; then
  echo "repos/file-vitals not found above $HERE" >&2
  exit 2
fi
SRC="$ROOT/repos/file-vitals"
GO_BIN="${GO_BIN:-$ROOT/.tools/go/bin/go}"
mkdir -p "$HERE/bin"

if [ -x "$ROOT/drafts/asset-delivery-preflight/bin/capability-adapter" ] && [ -x "$ROOT/drafts/asset-delivery-preflight/bin/finspect" ]; then
  cp "$ROOT/drafts/asset-delivery-preflight/bin/capability-adapter" "$HERE/bin/capability-adapter"
  cp "$ROOT/drafts/asset-delivery-preflight/bin/finspect" "$HERE/bin/finspect"
  chmod +x "$HERE/bin/capability-adapter" "$HERE/bin/finspect"
  echo "reused File Vitals binaries from drafts/asset-delivery-preflight/bin"
  echo "wrote $HERE/bin/finspect"
  echo "wrote $HERE/bin/capability-adapter"
  exit 0
fi

if [ ! -x "$GO_BIN" ]; then
  if command -v go >/dev/null 2>&1; then
    GO_BIN="$(command -v go)"
  else
    echo "Go 1.26.6+ is required to build File Vitals. Install it and retry." >&2
    exit 2
  fi
fi

GO_VERSION="$("$GO_BIN" env GOVERSION)"
case "$GO_VERSION" in
  go1.26.*|go1.27.*|go1.[3-9]*|go[2-9]*) ;;
  *)
    echo "File Vitals go.mod requires Go 1.26.6+. Found $GO_VERSION ($GO_BIN)." >&2
    exit 2
    ;;
esac

export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
export CGO_ENABLED="${CGO_ENABLED:-0}"
echo "building with $GO_BIN ($GO_VERSION)"
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$HERE/bin/finspect" ./cmd/finspect )
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$HERE/bin/capability-adapter" ./cmd/capability-adapter )
echo "wrote $HERE/bin/finspect"
echo "wrote $HERE/bin/capability-adapter"
