#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const output = process.argv[3] ? resolve(process.argv[3]) : null;
const skip = new Set([".verify", "dist", "bin", "node_modules"]);

async function walk(directory, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (skip.has(entry.name) || entry.name === ".git") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const bytes = await readFile(path);
    files.push({
      path: relative(root, path).split("\\").join("/"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    });
  }
}

const files = [];
const info = await stat(root);
if (!info.isDirectory()) throw new Error(`not a directory: ${root}`);
await walk(root, files);
const document = {
  root,
  files,
  count: files.length,
};
const text = `${JSON.stringify(document, null, 2)}\n`;
if (output) await writeFile(output, text);
else process.stdout.write(text);
