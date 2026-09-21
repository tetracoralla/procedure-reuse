import { readdir } from "node:fs/promises";
import { join, sep } from "node:path";

export async function listRegularFiles(root) {
  const files = [];
  async function walk(dir, rel) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, childRel);
        continue;
      }
      if (entry.isFile()) {
        files.push(childRel.split(sep).join("/"));
      }
    }
  }
  await walk(root, "");
  return files;
}
