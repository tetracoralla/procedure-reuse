/**
 * Load the two existing combinators by function import.
 *
 * This is the reuse boundary: slot rules stay in the lower modules.
 * The campaign never copies those rules; it only imports runPreflight.
 *
 * Resolution order: packed `deps/` (Kit payload), then sibling drafts
 * (workspace authoring). Ordinary ESM import — not Direct Runtime.
 */
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = dirname(HERE);

export const LOWER = {
  "asset-delivery": {
    kind: "asset-delivery",
    implementation: "org.openadam.asset-delivery-preflight@0.1.0",
    procedure: "org.openadam.asset-delivery.preflight@0.1.0",
    moduleCandidates: [
      join(PROJECT, "deps/asset-delivery-preflight/preflight.mjs"),
      join(PROJECT, "../asset-delivery-preflight/preflight.mjs"),
    ],
  },
  "channel-cover": {
    kind: "channel-cover",
    implementation: "org.openadam.channel-cover-preflight@0.1.0",
    procedure: "org.openadam.channel-cover.preflight@0.1.0",
    moduleCandidates: [
      join(PROJECT, "deps/channel-cover-preflight/src/preflight.mjs"),
      join(PROJECT, "../channel-cover-preflight/src/preflight.mjs"),
    ],
  },
};

const loaded = new Map();

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

export async function loadLower(kind) {
  const meta = LOWER[kind];
  if (!meta) {
    throw new Error(`unknown kit kind: ${kind}`);
  }
  if (loaded.has(kind)) {
    return loaded.get(kind);
  }
  const module = await importFirst(meta.moduleCandidates, meta.implementation);
  if (typeof module.runPreflight !== "function" || typeof module.parseSpec !== "function") {
    throw new Error(`${meta.implementation} does not export runPreflight/parseSpec`);
  }
  const binding = {
    ...meta,
    runPreflight: module.runPreflight,
    parseSpec: module.parseSpec,
    loadSpec: module.loadSpec,
  };
  loaded.set(kind, binding);
  return binding;
}

export async function resolveAdapter(explicit, projectRoot = PROJECT) {
  const candidates = [
    explicit,
    process.env.FILE_VITALS_ADAPTER,
    join(projectRoot, "bin/capability-adapter"),
    join(projectRoot, "../asset-delivery-preflight/bin/capability-adapter"),
    join(projectRoot, "../channel-cover-preflight/bin/capability-adapter"),
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
    `File Vitals JSONL adapter not found. Build it with scripts/build-file-vitals.sh. Looked at: ${candidates.join(", ")}`,
  );
}

export { PROJECT };
