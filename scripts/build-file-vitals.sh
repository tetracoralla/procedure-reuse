#!/bin/sh
# Build File Vitals CLI + JSONL adapter from an explicit pinned source.
# Does not assume author repos/file-vitals or .tools/go.
set -eu

HERE="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$HERE/.." && pwd)"
# shellcheck source=lib/deps.sh
. "$HERE/lib/deps.sh"

DEST=""
ALL_DRAFTS=0

usage() {
  cat <<'EOF'
Usage: scripts/build-file-vitals.sh [--dest DIR] [--all-drafts]

Source (first match):
  FILE_VITALS_SRC
  OPENADAM_FILE_VITALS_SOURCE_ROOT
  <repo>/.deps/file-vitals   (after: sh scripts/fetch-deps.sh --file-vitals)

Go: GO_BIN if set, otherwise `go` on PATH. Go 1.26.6+ is required
(File Vitals go.mod). This script does not use author .tools/go unless
GO_BIN points there. Official toolchain: https://go.dev/dl/
Optional: GOTOOLCHAIN=auto lets the Go toolchain fetch go1.26.6 from go.dev.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dest)
      DEST="$2"
      shift 2
      ;;
    --all-drafts)
      ALL_DRAFTS=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$DEST" ]; then
  DEST="$REPO_ROOT/drafts/asset-delivery-preflight/bin"
fi

SRC="$(resolve_file_vitals_src || true)"
if [ -z "${SRC:-}" ]; then
  echo "File Vitals source not found." >&2
  echo "Clone the pinned commit (deps/pins.json) with:" >&2
  echo "  sh scripts/fetch-deps.sh --file-vitals" >&2
  echo "or set FILE_VITALS_SRC to that checkout." >&2
  echo "Official repo: $(pin_string fileVitals.repo) @ $(pin_string fileVitals.commit)" >&2
  exit 2
fi

if [ ! -f "$SRC/go.mod" ] || [ ! -d "$SRC/cmd/finspect" ] || [ ! -d "$SRC/cmd/capability-adapter" ]; then
  echo "FILE_VITALS_SRC does not look like File Vitals: $SRC" >&2
  exit 2
fi

PINNED="$(pin_string fileVitals.commit)"
if [ -d "$SRC/.git" ]; then
  GOT="$(git -C "$SRC" rev-parse HEAD)"
  if [ "$GOT" != "$PINNED" ]; then
    echo "File Vitals checkout $SRC is $GOT, pinned $PINNED (deps/pins.json)." >&2
    echo "Check out the pin, or update deps/pins.json if the bump is intentional." >&2
    exit 2
  fi
fi

if [ -n "${GO_BIN:-}" ]; then
  :
elif command -v go >/dev/null 2>&1; then
  GO_BIN="$(command -v go)"
else
  echo "Go $(pin_string fileVitals.go)+ is required to build File Vitals." >&2
  echo "Install from https://go.dev/dl/ and retry, or set GO_BIN." >&2
  echo "This script does not use author .tools/go unless GO_BIN points there." >&2
  exit 2
fi

mkdir -p "$DEST"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
export CGO_ENABLED="${CGO_ENABLED:-0}"
GO_VERSION="$(cd "$SRC" && "$GO_BIN" env GOVERSION)"
GO_MINIMUM="go$(pin_string fileVitals.go)"
if ! awk -v got="$GO_VERSION" -v need="$GO_MINIMUM" 'BEGIN {
  sub(/^go/, "", got); sub(/^go/, "", need)
  split(got, g, "."); split(need, n, ".")
  for (i = 1; i <= 3; i++) {
    gv = (g[i] == "" ? 0 : g[i]) + 0
    nv = (n[i] == "" ? 0 : n[i]) + 0
    if (gv > nv) exit 0
    if (gv < nv) exit 1
  }
  exit 0
}'; then
  echo "File Vitals go.mod requires $GO_MINIMUM+. Found $GO_VERSION ($GO_BIN)." >&2
  echo "Install that toolchain from https://go.dev/dl/, or re-run with GOTOOLCHAIN=auto" >&2
  echo "to let the official Go toolchain fetch $GO_MINIMUM from go.dev." >&2
  exit 2
fi
echo "building File Vitals from $SRC with $GO_BIN ($GO_VERSION)"
# -trimpath keeps sealed pack from treating Go build paths as source-machine leaks.
# Only the two known commands are built; no other scripts from the clone are run.
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$DEST/finspect" ./cmd/finspect )
( cd "$SRC" && "$GO_BIN" build -trimpath -ldflags='-s -w' -o "$DEST/capability-adapter" ./cmd/capability-adapter )
chmod +x "$DEST/finspect" "$DEST/capability-adapter"
echo "wrote $DEST/finspect"
echo "wrote $DEST/capability-adapter"

copy_binaries() {
  other="$1"
  mkdir -p "$other"
  cp "$DEST/finspect" "$other/finspect"
  cp "$DEST/capability-adapter" "$other/capability-adapter"
  chmod +x "$other/finspect" "$other/capability-adapter"
  echo "copied File Vitals binaries to $other"
}

if [ "$ALL_DRAFTS" -eq 1 ]; then
  copy_binaries "$REPO_ROOT/drafts/channel-cover-preflight/bin"
  copy_binaries "$REPO_ROOT/drafts/batch-delivery-preflight/bin"
  if [ "$DEST" != "$REPO_ROOT/drafts/asset-delivery-preflight/bin" ]; then
    copy_binaries "$REPO_ROOT/drafts/asset-delivery-preflight/bin"
  fi
fi
