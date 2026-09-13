/**
 * Reuse the existing asset-delivery-preflight combinator.
 *
 * Slot comparison (name / format / width / height / alpha / missing / extra)
 * stays in that module. This draft only imports runPreflight / parseSpec.
 *
 * There is no packed deps/ payload for this generate draft. The sibling
 * combinator path is the only binding; the resolved file is reported.
 */
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT = dirname(HERE);

export const LOWER = {
  kind: "asset-delivery",
  implementation: "org.openadam.asset-delivery-preflight@0.1.0",
  procedure: "org.openadam.asset-delivery.preflight@0.1.0",
  moduleCandidates: [join(PROJECT, "../asset-delivery-preflight/preflight.mjs")],
};

let loaded = null;

export function resetLowerCache() {
  loaded = null;
}

export async function loadLower() {
  if (loaded) {
    return loaded;
  }
  const candidate = LOWER.moduleCandidates[0];
  try {
    await access(candidate);
  } catch (error) {
    throw new Error(`${LOWER.implementation} combinator not found: ${candidate}`);
  }
  let module;
  try {
    module = await import(pathToFileURL(candidate).href);
  } catch (error) {
    throw new Error(
      `${LOWER.implementation} failed to load ${candidate}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof module.runPreflight !== "function" || typeof module.parseSpec !== "function") {
    throw new Error(`${LOWER.implementation} does not export runPreflight/parseSpec (loaded ${candidate})`);
  }
  loaded = {
    ...LOWER,
    runPreflight: module.runPreflight,
    parseSpec: module.parseSpec,
    loadSpec: module.loadSpec,
    resolveAdapter: module.resolveAdapter,
    resolvedPath: candidate,
    bindingMode: "sibling-draft",
  };
  return loaded;
}

export async function resolveAdapter(explicit, projectRoot = PROJECT) {
  const candidates = [
    explicit,
    process.env.FILE_VITALS_ADAPTER,
    join(projectRoot, "../asset-delivery-preflight/bin/capability-adapter"),
    join(projectRoot, "../channel-cover-preflight/bin/capability-adapter"),
    join(projectRoot, "../batch-delivery-preflight/bin/capability-adapter"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    try {
      await access(resolved, fsConstants.X_OK);
      const info = await stat(resolved);
      if (info.isFile()) {
        return resolved;
      }
    } catch {
      // try next
    }
  }
  throw new Error(
    `File Vitals JSONL adapter not found. Clone the pinned File Vitals commit and run scripts/build-file-vitals.sh (docs/CLEAN_ENV.md). Looked at: ${candidates.join(", ")}`,
  );
}
