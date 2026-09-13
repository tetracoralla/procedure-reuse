/**
 * Resolve pinned public dependency checkouts for authoring-time scripts.
 * Env vars win. Otherwise .deps/ next to deps/pins.json.
 * Does not assume an author repos/ tree.
 */
import { dirname, join, resolve } from "node:path";
import { stat } from "node:fs/promises";

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

export async function findPinsRoot(start) {
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

export async function resolveFileVitalsSrc(start) {
  return resolveDep(start, {
    envKeys: ["FILE_VITALS_SRC", "OPENADAM_FILE_VITALS_SOURCE_ROOT"],
    dirName: "file-vitals",
    label: "File Vitals",
  });
}

export async function resolveProcedureContractsSrc(start) {
  return resolveDep(start, {
    envKeys: ["PROCEDURE_CONTRACTS_SRC"],
    dirName: "procedure-contracts",
    label: "procedure-contracts",
  });
}

export async function resolveCapabilityContractsSrc(start) {
  return resolveDep(start, {
    envKeys: ["CAPABILITY_CONTRACTS_SRC"],
    dirName: "capability-contracts",
    label: "capability-contracts",
  });
}

/** @deprecated Use resolve*Src. Kept so missing-contracts init still matches a clear error. */
export async function findWorkspace(start) {
  const root = await findPinsRoot(start);
  if (root !== null) {
    return root;
  }
  throw new Error(
    "Could not find the workspace root (deps/pins.json). Set FILE_VITALS_SRC / PROCEDURE_CONTRACTS_SRC. See docs/CLEAN_ENV.md.",
  );
}
