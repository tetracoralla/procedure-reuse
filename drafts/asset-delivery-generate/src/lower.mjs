/**
 * Reuse the existing asset-delivery-preflight combinator.
 *
 * Slot comparison (name / format / width / height / alpha / missing / extra)
 * stays in that module. This draft only imports runPreflight / parseSpec.
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

async function importFirst(candidates, label) {
  const errors = [];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return await import(pathToFileURL(candidate).href);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`${label} combinator not found. Looked at: ${errors.join("; ")}`);
}

export async function loadLower() {
  if (loaded) {
    return loaded;
  }
  const module = await importFirst(LOWER.moduleCandidates, LOWER.implementation);
  if (typeof module.runPreflight !== "function" || typeof module.parseSpec !== "function") {
    throw new Error(`${LOWER.implementation} does not export runPreflight/parseSpec`);
  }
  loaded = {
    ...LOWER,
    runPreflight: module.runPreflight,
    parseSpec: module.parseSpec,
    loadSpec: module.loadSpec,
    resolveAdapter: module.resolveAdapter,
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
    `File Vitals JSONL adapter not found. Build it with drafts/asset-delivery-preflight/scripts/build-file-vitals.sh. Looked at: ${candidates.join(", ")}`,
  );
}
