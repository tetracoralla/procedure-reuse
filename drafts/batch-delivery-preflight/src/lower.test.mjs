#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEV_BINDINGS_ENV, loadLower, resetLowerCache } from "./lower.mjs";

const STUB = `export function runPreflight() { return { status: "stub" }; }
export function parseSpec(spec) { return spec; }
export function loadSpec(raw) { return JSON.parse(raw); }
`;

const BROKEN = `throw new Error("packed-broken");\n`;

async function projectTree() {
  const parent = await mkdtemp(join(tmpdir(), "batch-lower-"));
  const root = join(parent, "batch-delivery-preflight");
  const packedDir = join(root, "deps/asset-delivery-preflight");
  const siblingDir = join(parent, "asset-delivery-preflight");
  await mkdir(packedDir, { recursive: true });
  await mkdir(siblingDir, { recursive: true });
  return {
    root,
    packed: join(packedDir, "preflight.mjs"),
    sibling: join(siblingDir, "preflight.mjs"),
  };
}

test("broken packed deps fail closed without a sibling swap", async () => {
  const tree = await projectTree();
  await writeFile(tree.packed, BROKEN);
  await writeFile(tree.sibling, STUB);
  resetLowerCache();
  await assert.rejects(
    () => loadLower("asset-delivery", { projectRoot: tree.root, devBindings: false }),
    (error) => {
      assert.match(error.message, /packed module/);
      assert.match(error.message, /packed-broken|SyntaxError|failed to load/);
      assert.doesNotMatch(error.message, /Looked at:/);
      return true;
    },
  );
});

test("explicit dev bindings may fall back and must report the real path", async () => {
  const tree = await projectTree();
  await writeFile(tree.packed, BROKEN);
  await writeFile(tree.sibling, STUB);
  resetLowerCache();
  const binding = await loadLower("asset-delivery", { projectRoot: tree.root, devBindings: true });
  assert.equal(binding.bindingMode, "dev-fallback");
  assert.equal(binding.resolvedPath, tree.sibling);
  assert.equal(typeof binding.packedError, "string");
  assert.equal(binding.implementation, "org.openadam.asset-delivery-preflight@0.1.0");
  assert.equal((await binding.runPreflight()).status, "stub");
});

test("authoring without deps/ loads the sibling and labels it sibling-draft", async () => {
  const tree = await projectTree();
  await writeFile(tree.sibling, STUB);
  resetLowerCache();
  const binding = await loadLower("asset-delivery", { projectRoot: tree.root, devBindings: false });
  assert.equal(binding.bindingMode, "sibling-draft");
  assert.equal(binding.resolvedPath, tree.sibling);
  assert.equal(binding.packedError, null);
});

test("packed module is preferred when it loads", async () => {
  const tree = await projectTree();
  await writeFile(tree.packed, STUB);
  await writeFile(tree.sibling, `export function runPreflight() { return { status: "sibling" }; }
export function parseSpec(spec) { return spec; }
export function loadSpec(raw) { return JSON.parse(raw); }
`);
  resetLowerCache();
  const binding = await loadLower("asset-delivery", { projectRoot: tree.root, devBindings: false });
  assert.equal(binding.bindingMode, "packed");
  assert.equal(binding.resolvedPath, tree.packed);
  assert.equal((await binding.runPreflight()).status, "stub");
});

test("dev-bindings env name is OPENADAM_DRAFT_DEV_BINDINGS", () => {
  assert.equal(DEV_BINDINGS_ENV, "OPENADAM_DRAFT_DEV_BINDINGS");
});
