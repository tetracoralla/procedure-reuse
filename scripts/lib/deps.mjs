/**
 * Resolve pinned public dependency checkouts.
 * Env vars win. Otherwise use gitignored .deps/ next to deps/pins.json.
 * Does not walk an author repos/ tree.
 */
import { dirname, join, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
export const SCRIPTS_ROOT = resolve(THIS_DIR, "..");
export const DEFAULT_REPO_ROOT = resolve(SCRIPTS_ROOT, "..");

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function findPinsRoot(start = DEFAULT_REPO_ROOT) {
  let current = resolve(start);
  while (true) {
    if (await isFile(join(current, "deps", "pins.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function loadPins(start = DEFAULT_REPO_ROOT) {
  const root = await findPinsRoot(start);
  if (root === null) {
    throw new Error("deps/pins.json was not found. Run from a procedure-reuse checkout (docs/CLEAN_ENV.md).");
  }
  return {
    root,
    pins: JSON.parse(await readFile(join(root, "deps", "pins.json"), "utf8")),
  };
}

async function resolveDep(start, { envKeys, dirName, label }) {
  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      const resolved = resolve(value);
      if (!(await isDir(resolved))) {
        throw new Error(`${label}: ${key} is not a directory: ${resolved}`);
      }
      return resolved;
    }
  }
  const root = await findPinsRoot(start);
  if (root !== null) {
    const pinned = join(root, ".deps", dirName);
    if (await isDir(pinned)) {
      return pinned;
    }
  }
  throw new Error(
    `${label} source not found. Set ${envKeys[0]} to a clone of the pinned commit, or run scripts/fetch-deps.sh (docs/CLEAN_ENV.md).`,
  );
}

export async function resolveFileVitalsSrc(start = DEFAULT_REPO_ROOT) {
  return resolveDep(start, {
    envKeys: ["FILE_VITALS_SRC", "OPENADAM_FILE_VITALS_SOURCE_ROOT"],
    dirName: "file-vitals",
    label: "File Vitals",
  });
}

export async function resolveProcedureContractsSrc(start = DEFAULT_REPO_ROOT) {
  return resolveDep(start, {
    envKeys: ["PROCEDURE_CONTRACTS_SRC"],
    dirName: "procedure-contracts",
    label: "procedure-contracts",
  });
}

export async function resolveCapabilityContractsSrc(start = DEFAULT_REPO_ROOT) {
  return resolveDep(start, {
    envKeys: ["CAPABILITY_CONTRACTS_SRC"],
    dirName: "capability-contracts",
    label: "capability-contracts",
  });
}

export async function resolveDevkitSrc(start = DEFAULT_REPO_ROOT) {
  return resolveDep(start, {
    envKeys: ["OPENADAM_DEVKIT_ROOT"],
    dirName: "agent-tool-development-kit",
    label: "Agent Tool Development Kit",
  });
}
