#!/bin/sh
# Optional helper: install Node 22+ into .tools/node from nodejs.org official dist.
# Clean-environment checks use Node 22 on PATH (docs/CLEAN_ENV.md).
# Do not treat .tools/node as required.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
NODE_DIR="$ROOT/.tools/node"
VERSION="${NODE_VERSION:-v22.23.2}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *)
    echo "unsupported architecture for Node toolchain: $ARCH" >&2
    exit 2
    ;;
esac

node_ok() {
  if command -v node >/dev/null 2>&1; then
    found="$(node -v 2>/dev/null || true)"
    case "$found" in
      v22.*|v23.*|v24.*|v2[5-9].*)
        echo "using PATH node $found ($(command -v node))"
        return 0
        ;;
    esac
  fi
  if [ -x "$NODE_DIR/bin/node" ]; then
    found="$("$NODE_DIR/bin/node" -v 2>/dev/null || true)"
    case "$found" in
      v22.*|v23.*|v24.*|v2[5-9].*) return 0 ;;
    esac
  fi
  return 1
}

if command -v node >/dev/null 2>&1; then
  found="$(node -v 2>/dev/null || true)"
  case "$found" in
    v22.*|v23.*|v24.*|v2[5-9].*)
      echo "using PATH node $found ($(command -v node))"
      exit 0
      ;;
  esac
fi
if [ -x "$NODE_DIR/bin/node" ]; then
  found="$("$NODE_DIR/bin/node" -v 2>/dev/null || true)"
  case "$found" in
    v22.*|v23.*|v24.*|v2[5-9].*)
      echo "$NODE_DIR/bin/node ($found)"
      exit 0
      ;;
  esac
fi

TARBALL="node-${VERSION}-linux-${NODE_ARCH}.tar.gz"
URL="https://nodejs.org/dist/${VERSION}/${TARBALL}"
mkdir -p "$ROOT/.tools"
echo "downloading $URL"
curl -fsSL "$URL" -o "/tmp/${TARBALL}"
rm -rf "$NODE_DIR" "$ROOT/.tools/node-${VERSION}-linux-${NODE_ARCH}"
tar -xzf "/tmp/${TARBALL}" -C "$ROOT/.tools"
mv "$ROOT/.tools/node-${VERSION}-linux-${NODE_ARCH}" "$NODE_DIR"
if ! node_ok; then
  echo "Node 22+ is required for procedure-contracts. Found $("$NODE_DIR/bin/node" -v 2>/dev/null || echo missing)." >&2
  exit 2
fi
echo "wrote $NODE_DIR/bin/node ($("$NODE_DIR/bin/node" -v))"
