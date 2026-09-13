/**
 * Load the two existing combinators by function import.
 *
 * This is the reuse boundary: slot rules stay in the lower modules.
 * The campaign never copies those rules; it only imports runPreflight.
 *
 * Production (default): load only packed `deps/`. If that file is present
 * and fails to evaluate, this module fails. It does not silently try a
 * sibling checkout.
 *
 * Authoring: when `deps/` is absent, the sibling draft is used and the
 * resolved path is reported. Falling back from a *broken* packed module
 * to a sibling requires OPENADAM_DRAFT_DEV_BINDINGS=1.
 *
 * Ordinary ESM import — not Direct Runtime.
 */
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = dirname(HERE);

export const DEV_BINDINGS_ENV = "OPENADAM_DRAFT_DEV_BINDINGS";

export const LOWER = {
  "asset-delivery": {
    kind: "asset-delivery",
    implementation: "org.openadam.asset-delivery-preflight@0.1.0",
    procedure: "org.openadam.asset-delivery.preflight@0.1.0",
    packedRel: "deps/asset-delivery-preflight/preflight.mjs",
    siblingRel: "../asset-delivery-preflight/preflight.mjs",
    moduleCandidates: [
      join(PROJECT, "deps/asset-delivery-preflight/preflight.mjs"),
      join(PROJECT, "../asset-delivery-preflight/preflight.mjs"),
    ],
  },
  "channel-cover": {
    kind: "channel-cover",
    implementation: "org.openadam.channel-cover-preflight@0.1.0",
    procedure: "org.openadam.channel-cover.preflight@0.1.0",
    packedRel: "deps/channel-cover-preflight/src/preflight.mjs",
    siblingRel: "../channel-cover-preflight/src/preflight.mjs",
    moduleCandidates: [
      join(PROJECT, "deps/channel-cover-preflight/src/preflight.mjs"),
      join(PROJECT, "../channel-cover-preflight/src/preflight.mjs"),
    ],
  },
};

const loaded = new Map();

export function resetLowerCache() {
  loaded.clear();
}

export function devBindingsEnabled(env = process.env) {
  const value = env[DEV_BINDINGS_ENV];
  return value === "1" || value === "true" || value === "yes";
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function importModule(path) {
  return import(pathToFileURL(path).href);
}

function bind(meta, module, extra) {
  if (typeof module.runPreflight !== "function" || typeof module.parseSpec !== "function") {
    throw new Error(`${meta.implementation} does not export runPreflight/parseSpec (loaded ${extra.resolvedPath})`);
  }
  return {
    kind: meta.kind,
    implementation: meta.implementation,
    procedure: meta.procedure,
    runPreflight: module.runPreflight,
    parseSpec: module.parseSpec,
    loadSpec: module.loadSpec,
    resolvedPath: extra.resolvedPath,
    bindingMode: extra.bindingMode,
    packedPath: extra.packedPath,
    packedError: extra.packedError ?? null,
  };
}

export async function loadLower(kind, options = {}) {
  const meta = LOWER[kind];
  if (!meta) {
    throw new Error(`unknown kit kind: ${kind}`);
  }
  const projectRoot = options.projectRoot ?? PROJECT;
  const allowDev = options.devBindings ?? devBindingsEnabled();
  const cacheKey = `${kind}::${projectRoot}::${allowDev ? "dev" : "prod"}`;
  if (loaded.has(cacheKey)) {
    return loaded.get(cacheKey);
  }

  const packedPath = join(projectRoot, meta.packedRel);
  const siblingPath = join(projectRoot, meta.siblingRel);
  const packedPresent = await exists(packedPath);

  if (packedPresent) {
    try {
      const module = await importModule(packedPath);
      const binding = bind(meta, module, {
        resolvedPath: packedPath,
        bindingMode: "packed",
        packedPath,
      });
      loaded.set(cacheKey, binding);
      return binding;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!allowDev) {
        throw new Error(
          `${meta.implementation} packed module at ${packedPath} failed to load: ${message}. Production does not fall back to a sibling checkout. Set ${DEV_BINDINGS_ENV}=1 to allow an explicit authoring fallback.`,
        );
      }
      if (!(await exists(siblingPath))) {
        throw new Error(
          `${meta.implementation} packed module failed (${message}) and sibling ${siblingPath} is missing`,
        );
      }
      const module = await importModule(siblingPath);
      const binding = bind(meta, module, {
        resolvedPath: siblingPath,
        bindingMode: "dev-fallback",
        packedPath,
        packedError: message,
      });
      loaded.set(cacheKey, binding);
      return binding;
    }
  }

  if (!(await exists(siblingPath))) {
    throw new Error(
      `${meta.implementation} combinator not found. Looked at packed ${packedPath} and sibling ${siblingPath}`,
    );
  }
  const module = await importModule(siblingPath);
  const binding = bind(meta, module, {
    resolvedPath: siblingPath,
    bindingMode: "sibling-draft",
    packedPath,
  });
  loaded.set(cacheKey, binding);
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
