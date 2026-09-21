#!/bin/sh
# Build File Vitals into this project's bin/. Prefers the repo-root builder.
# Does not assume author repos/file-vitals.
set -eu
HERE="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CUR="$HERE"
ROOT_BUILD=""
while [ "$CUR" != "/" ]; do
  if [ -f "$CUR/scripts/build-file-vitals.sh" ] && [ -f "$CUR/deps/pins.json" ]; then
    ROOT_BUILD="$CUR/scripts/build-file-vitals.sh"
    break
  fi
  CUR="$(dirname "$CUR")"
done
if [ -n "$ROOT_BUILD" ]; then
  exec sh "$ROOT_BUILD" --dest "$HERE/bin" "$@"
fi
if [ -z "${FILE_VITALS_SRC:-}" ]; then
  echo "FILE_VITALS_SRC is required when this project is not inside procedure-reuse." >&2
  echo "Clone https://github.com/tetracoralla/file-vitals at the commit in deps/pins.json." >&2
  echo "See docs/CLEAN_ENV.md." >&2
  exit 2
fi
SRC="$FILE_VITALS_SRC"
if [ -n "${GO_BIN:-}" ]; then
  :
elif command -v go >/dev/null 2>&1; then
  GO_BIN="$(command -v go)"
else
  echo "Go 1.26.6+ is required to build File Vitals. Install from https://go.dev/dl/ or set GO_BIN." >&2
  exit 2
fi
mkdir -p "$HERE/bin"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
export CGO_ENABLED="${CGO_ENABLED:-0}"
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$HERE/bin/finspect" ./cmd/finspect )
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$HERE/bin/capability-adapter" ./cmd/capability-adapter )
chmod +x "$HERE/bin/finspect" "$HERE/bin/capability-adapter"
echo "wrote $HERE/bin/finspect"
echo "wrote $HERE/bin/capability-adapter"
