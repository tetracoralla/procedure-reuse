#!/bin/sh
# Clone official GitHub repos at the commits in deps/pins.json into .deps/.
# Does not run scripts from the cloned trees. Does not use author repos/.
set -eu

HERE="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$HERE/.." && pwd)"
# shellcheck source=lib/deps.sh
. "$HERE/lib/deps.sh"

DEPS_ROOT="${OPENADAM_DEPS_ROOT:-$REPO_ROOT/.deps}"
WANT_FV=0
WANT_KIT=0
WANT_PC=0
WANT_CC=0

usage() {
  cat <<'EOF'
Usage: scripts/fetch-deps.sh [--file-vitals] [--kit] [--procedure-contracts] [--capability-contracts] [--all]

Clones only https://github.com/tetracoralla/* at the SHA in deps/pins.json.
Uses git clone / git fetch of that official remote. No other download scripts.
EOF
}

if [ "$#" -eq 0 ]; then
  usage
  exit 2
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --file-vitals) WANT_FV=1; shift ;;
    --kit) WANT_KIT=1; shift ;;
    --procedure-contracts) WANT_PC=1; shift ;;
    --capability-contracts) WANT_CC=1; shift ;;
    --all) WANT_FV=1; WANT_KIT=1; WANT_PC=1; WANT_CC=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

clone_pinned() {
  name="$1"
  url="$2"
  sha="$3"
  dest="$DEPS_ROOT/$name"
  case "$url" in
    https://github.com/tetracoralla/*) ;;
    *)
      echo "refusing non-official remote for $name: $url" >&2
      exit 2
      ;;
  esac
  if [ -d "$dest/.git" ]; then
    current="$(git -C "$dest" rev-parse HEAD)"
    if [ "$current" = "$sha" ]; then
      echo "have $name@$sha"
      return 0
    fi
    echo "updating $name ($current -> $sha)"
  else
    echo "cloning $url @$sha"
  fi
  rm -rf "$dest"
  mkdir -p "$dest"
  git -C "$dest" init --quiet
  git -C "$dest" remote add origin "$url"
  if ! git -C "$dest" fetch --quiet --depth 1 origin "$sha"; then
    echo "shallow fetch of $sha failed; cloning the repository then checking out the pin" >&2
    rm -rf "$dest"
    git clone --quiet "$url" "$dest"
    git -C "$dest" checkout --quiet "$sha"
  else
    git -C "$dest" checkout --quiet --detach FETCH_HEAD
  fi
  got="$(git -C "$dest" rev-parse HEAD)"
  if [ "$got" != "$sha" ]; then
    echo "pin mismatch for $name: wanted $sha got $got" >&2
    exit 2
  fi
  echo "wrote $dest ($got)"
}

PINS="$REPO_ROOT/deps/pins.json"
if [ ! -f "$PINS" ]; then
  echo "missing $PINS" >&2
  exit 2
fi

mkdir -p "$DEPS_ROOT"

if [ "$WANT_FV" -eq 1 ]; then
  clone_pinned file-vitals "$(pin_string fileVitals.repo)" "$(pin_string fileVitals.commit)"
fi
if [ "$WANT_KIT" -eq 1 ]; then
  clone_pinned agent-tool-development-kit "$(pin_string agentToolDevelopmentKit.repo)" "$(pin_string agentToolDevelopmentKit.commit)"
fi
if [ "$WANT_PC" -eq 1 ]; then
  clone_pinned procedure-contracts "$(pin_string procedureContracts.repo)" "$(pin_string procedureContracts.commit)"
fi
if [ "$WANT_CC" -eq 1 ]; then
  clone_pinned capability-contracts "$(pin_string capabilityContracts.repo)" "$(pin_string capabilityContracts.commit)"
fi
