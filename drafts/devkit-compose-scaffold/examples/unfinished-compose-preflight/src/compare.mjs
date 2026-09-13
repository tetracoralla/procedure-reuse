/**
 * AUTHOR HOOK — comparison rules.
 *
 * The orchestrator already records missing required slots and extra files.
 * Implement compareSlot so observations are checked against the spec.
 * Until then this module throws CORE_NOT_IMPLEMENTED so the method cannot
 * pretend to pass.
 */
export class AuthoringError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AuthoringError";
  }
}

export function compareSlot(_slot, _observation, _spec) {
  throw new AuthoringError(
    "CORE_NOT_IMPLEMENTED",
    "Replace src/compare.mjs compareSlot with the product-specific checks. The spec and this function must change execution.",
  );
}

export function extraFiles(diskFiles, declaredPaths, _spec) {
  return diskFiles.filter((path) => !declaredPaths.has(path));
}
