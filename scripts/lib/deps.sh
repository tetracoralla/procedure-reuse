# Shared path resolution for pinned public dependencies.
# Source after setting REPO_ROOT to the procedure-reuse checkout
# (the directory that contains deps/pins.json).

_pins_json() {
  printf '%s\n' "$REPO_ROOT/deps/pins.json"
}

pin_string() {
  # pin_string fileVitals.commit
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const pins = JSON.parse(readFileSync(process.argv[1], "utf8"));
    const path = process.argv[2].split(".");
    let value = pins;
    for (const key of path) {
      value = value?.[key];
    }
    if (typeof value !== "string" || value.length === 0) {
      process.exit(2);
    }
    process.stdout.write(value);
  ' "$(_pins_json)" "$1"
}

discover_repo_root() {
  _cur="$1"
  while [ "$_cur" != "/" ]; do
    if [ -f "$_cur/deps/pins.json" ]; then
      printf '%s\n' "$_cur"
      return 0
    fi
    _cur="$(dirname "$_cur")"
  done
  return 1
}

resolve_file_vitals_src() {
  if [ -n "${FILE_VITALS_SRC:-}" ]; then
    printf '%s\n' "$FILE_VITALS_SRC"
    return 0
  fi
  if [ -n "${OPENADAM_FILE_VITALS_SOURCE_ROOT:-}" ]; then
    printf '%s\n' "$OPENADAM_FILE_VITALS_SOURCE_ROOT"
    return 0
  fi
  if [ -n "${REPO_ROOT:-}" ] && [ -d "$REPO_ROOT/.deps/file-vitals" ]; then
    printf '%s\n' "$REPO_ROOT/.deps/file-vitals"
    return 0
  fi
  return 1
}

resolve_procedure_contracts_src() {
  if [ -n "${PROCEDURE_CONTRACTS_SRC:-}" ]; then
    printf '%s\n' "$PROCEDURE_CONTRACTS_SRC"
    return 0
  fi
  if [ -n "${REPO_ROOT:-}" ] && [ -d "$REPO_ROOT/.deps/procedure-contracts" ]; then
    printf '%s\n' "$REPO_ROOT/.deps/procedure-contracts"
    return 0
  fi
  return 1
}

resolve_capability_contracts_src() {
  if [ -n "${CAPABILITY_CONTRACTS_SRC:-}" ]; then
    printf '%s\n' "$CAPABILITY_CONTRACTS_SRC"
    return 0
  fi
  if [ -n "${REPO_ROOT:-}" ] && [ -d "$REPO_ROOT/.deps/capability-contracts" ]; then
    printf '%s\n' "$REPO_ROOT/.deps/capability-contracts"
    return 0
  fi
  return 1
}

resolve_devkit_src() {
  if [ -n "${OPENADAM_DEVKIT_ROOT:-}" ]; then
    printf '%s\n' "$OPENADAM_DEVKIT_ROOT"
    return 0
  fi
  if [ -n "${REPO_ROOT:-}" ] && [ -d "$REPO_ROOT/.deps/agent-tool-development-kit" ]; then
    printf '%s\n' "$REPO_ROOT/.deps/agent-tool-development-kit"
    return 0
  fi
  return 1
}

require_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  echo "Node is required on PATH. Supported platform: Linux x64 + Node 22 (docs/CLEAN_ENV.md)." >&2
  echo "This script does not use an author .tools/node tree unless NODE_BIN points there." >&2
  return 1
}
