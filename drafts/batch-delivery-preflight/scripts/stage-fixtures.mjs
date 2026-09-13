#!/usr/bin/env node
/**
 * Copy real lower-method fixtures and kit specs into this campaign draft.
 * Does not regenerate pixels and does not copy compare rules.
 */
import { cp, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");
const ASSET = resolve(PROJECT, "../asset-delivery-preflight");
const COVER = resolve(PROJECT, "../channel-cover-preflight");

async function copyDir(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

await copyDir(join(ASSET, "fixtures/good"), join(PROJECT, "fixtures/good/icons"));
await copyDir(join(COVER, "fixtures/good"), join(PROJECT, "fixtures/good/covers"));
await copyDir(join(ASSET, "fixtures/bad/wrong-size"), join(PROJECT, "fixtures/icons-wrong-size/icons"));
await copyDir(join(COVER, "fixtures/good"), join(PROJECT, "fixtures/icons-wrong-size/covers"));
await copyDir(join(ASSET, "fixtures/good"), join(PROJECT, "fixtures/missing-covers/icons"));

await mkdir(join(PROJECT, "specs/kits"), { recursive: true });
await cp(join(ASSET, "specs/good.json"), join(PROJECT, "specs/kits/asset-delivery.good.json"));
await cp(join(ASSET, "specs/good-wrong-height.json"), join(PROJECT, "specs/kits/asset-delivery.wrong-height.json"));
await cp(join(COVER, "specs/good.json"), join(PROJECT, "specs/kits/channel-cover.good.json"));

process.stdout.write("staged lower fixtures and kit specs from sibling drafts\n");
