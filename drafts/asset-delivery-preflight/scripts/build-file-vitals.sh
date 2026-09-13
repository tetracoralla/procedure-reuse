#!/bin/sh
# Build File Vitals CLI + JSONL adapter into this draft's bin/. Does not modify repos/file-vitals sources.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
DRAFT="$ROOT/drafts/asset-delivery-preflight"
SRC="$ROOT/repos/file-vitals"
GO_BIN="${GO_BIN:-$ROOT/.tools/go/bin/go}"

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
    echo "This draft installs a local toolchain at $ROOT/.tools/go when needed." >&2
    exit 2
    ;;
esac

mkdir -p "$DRAFT/bin"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
export CGO_ENABLED="${CGO_ENABLED:-0}"
echo "building with $GO_BIN ($GO_VERSION)"
# -trimpath keeps sealed pack from treating Go build paths as source-machine leaks.
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$DRAFT/bin/finspect" ./cmd/finspect )
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$DRAFT/bin/capability-adapter" ./cmd/capability-adapter )
echo "wrote $DRAFT/bin/finspect"
echo "wrote $DRAFT/bin/capability-adapter"
