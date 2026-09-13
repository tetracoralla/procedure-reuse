#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng, paintPattern } from "../src/png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "../fixtures/source");

await mkdir(SOURCE, { recursive: true });
await writeFile(join(SOURCE, "master-256.png"), encodePng(paintPattern(256, 256, { alpha: true })));
await writeFile(join(SOURCE, "too-small-32.png"), encodePng(paintPattern(32, 32, { alpha: true })));
await writeFile(join(SOURCE, "opaque-256.png"), encodePng(paintPattern(256, 256, { alpha: false })));
process.stdout.write("wrote fixtures/source/{master-256,too-small-32,opaque-256}.png\n");
