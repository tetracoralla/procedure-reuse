import { dirname, join, resolve } from "node:path";
import { stat } from "node:fs/promises";

export async function findWorkspace(start) {
  let current = resolve(start);
  while (true) {
    try {
      const fileVitals = await stat(join(current, "repos", "file-vitals"));
      const procedures = await stat(join(current, "repos", "procedure-contracts"));
      if (fileVitals.isDirectory() && procedures.isDirectory()) {
        return current;
      }
    } catch {
      // keep walking
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        "Could not find the workspace root (repos/file-vitals and repos/procedure-contracts).",
      );
    }
    current = parent;
  }
}
