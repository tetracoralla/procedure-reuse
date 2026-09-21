/**
 * Locate a built File Vitals JSONL adapter, or skip adapter-backed tests.
 */
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const FILE_VITALS_SKIP_REASON =
  "File Vitals adapter not built; clone the pinned source and run scripts/build-file-vitals.sh (docs/CLEAN_ENV.md)";

export async function findFileVitalsAdapter() {
  const candidates = [
    process.env.FILE_VITALS_ADAPTER,
    join(ROOT, "drafts/asset-delivery-preflight/bin/capability-adapter"),
    join(ROOT, "drafts/channel-cover-preflight/bin/capability-adapter"),
    join(ROOT, "drafts/batch-delivery-preflight/bin/capability-adapter"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const path = resolve(candidate);
    try {
      await access(path, fsConstants.X_OK);
      const info = await stat(path);
      if (info.isFile()) {
        return path;
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function adapterTest(testFn) {
  return (name, fn) =>
    testFn(name, async (t) => {
      const adapter = await findFileVitalsAdapter();
      if (adapter === null) {
        if (process.env.REQUIRE_FILE_VITALS === "1") {
          throw new Error(FILE_VITALS_SKIP_REASON);
        }
        t.skip(FILE_VITALS_SKIP_REASON);
        return;
      }
      await fn(t);
    });
}
