#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..");
const CLI = join(HERE, "cli.mjs");

function runCli(spec, root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI, "--spec", spec, "--root", root, "--compact"], {
      cwd: PROJECT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      let report = null;
      try {
        report = JSON.parse(stdout);
      } catch {
        report = null;
      }
      resolvePromise({ code, stdout, stderr, report });
    });
  });
}

function kitById(report, id) {
  return (report.kits ?? []).find((kit) => kit.id === id);
}

function failedChecks(report) {
  return (report.checks ?? []).filter((check) => !check.passed);
}

test("good two-kit campaign passes", async () => {
  const { code, report, stderr } = await runCli("specs/good.json", "fixtures/good");
  assert.equal(stderr, "");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.failed, 0);
  assert.deepEqual(report.summary.failedKits, []);
  assert.deepEqual(report.summary.failedIds, []);
  assert.equal(report.summary.kits, 2);
  assert.equal(report.summary.present, 2);
  assert.equal(kitById(report, "icons").status, "pass");
  assert.equal(kitById(report, "covers").status, "pass");
  assert.equal(kitById(report, "icons").kind, "asset-delivery");
  assert.equal(kitById(report, "covers").kind, "channel-cover");
  assert.equal(report.observer.capability, "org.openadam.file.inspect@0.1.0");
  assert.match(report.observer.note, /not raster.verify/i);
  assert.equal(
    kitById(report, "icons").method.procedure,
    "org.openadam.asset-delivery.preflight@0.1.0",
  );
  assert.equal(
    kitById(report, "covers").method.procedure,
    "org.openadam.channel-cover.preflight@0.1.0",
  );
});

test("missing required cover kit fails and names the kit", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/missing-covers");
  assert.equal(code, 1);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.summary.failedKits, ["covers"]);
  assert.ok(report.summary.failedIds.includes("kitMissing"));
  const missing = failedChecks(report).find((check) => check.id === "kitMissing");
  assert.equal(missing.kit, "covers");
  assert.equal(missing.path, "covers");
  assert.equal(kitById(report, "covers").present, false);
  assert.equal(kitById(report, "covers").lower, null);
  assert.equal(kitById(report, "icons").status, "pass");
});

test("wrong icon-64 size fails the batch and localizes kit/slot/check", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/icons-wrong-size");
  assert.equal(code, 1);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.summary.failedKits, ["icons"]);
  assert.equal(kitById(report, "covers").status, "pass");
  const width = failedChecks(report).find((check) => check.id === "width");
  const height = failedChecks(report).find((check) => check.id === "height");
  assert.equal(width.kit, "icons");
  assert.equal(width.slot, "icon-64");
  assert.equal(width.expected, 64);
  assert.equal(width.observed, 48);
  assert.equal(height.kit, "icons");
  assert.equal(height.slot, "icon-64");
  assert.ok(report.summary.failedIds.includes("width"));
  assert.ok(report.summary.failedIds.includes("height"));
});

test("dropping the failing kit from the campaign list flips fail to pass", async () => {
  const twoKit = await runCli("specs/good.json", "fixtures/icons-wrong-size");
  const coversOnly = await runCli("specs/covers-only.json", "fixtures/icons-wrong-size");
  assert.equal(twoKit.code, 1);
  assert.equal(twoKit.report.status, "fail");
  assert.deepEqual(twoKit.report.summary.failedKits, ["icons"]);
  assert.equal(coversOnly.code, 0);
  assert.equal(coversOnly.report.status, "pass");
  assert.deepEqual(coversOnly.report.summary.failedKits, []);
  assert.equal(coversOnly.report.summary.kits, 1);
  assert.equal(kitById(coversOnly.report, "icons"), undefined);
  assert.equal(kitById(coversOnly.report, "covers").status, "pass");
});

test("changing the lower icon height spec on the same good files flips pass to fail", async () => {
  const good = await runCli("specs/good.json", "fixtures/good");
  const mutated = await runCli("specs/icons-wrong-height.json", "fixtures/good");
  assert.equal(good.code, 0);
  assert.equal(mutated.code, 1);
  assert.equal(mutated.report.status, "fail");
  assert.deepEqual(mutated.report.summary.failedKits, ["icons"]);
  const height = failedChecks(mutated.report).find((check) => check.id === "height");
  assert.equal(height.kit, "icons");
  assert.equal(height.slot, "og-cover");
  assert.equal(height.expected, 361);
  assert.equal(height.observed, 360);
  assert.equal(kitById(mutated.report, "covers").status, "pass");
});

test("each lower inspect grant is the kit root, not the campaign root", async () => {
  const { report } = await runCli("specs/good.json", "fixtures/good");
  const icons = kitById(report, "icons");
  const covers = kitById(report, "covers");
  const campaignRoot = resolve(PROJECT, "fixtures/good");
  assert.equal(icons.workspaceRoot, resolve(campaignRoot, "icons"));
  assert.equal(covers.workspaceRoot, resolve(campaignRoot, "covers"));
  assert.notEqual(icons.workspaceRoot, campaignRoot);
  assert.notEqual(covers.workspaceRoot, campaignRoot);
  assert.equal(icons.lower.observer.capability, "org.openadam.file.inspect@0.1.0");
  assert.equal(covers.lower.observer.capability, "org.openadam.file.inspect@0.1.0");
});

test("upper sources dispatch to lower runPreflight and do not copy slot rules", async () => {
  const files = [
    "src/preflight.mjs",
    "src/spec.mjs",
    "src/cli.mjs",
    "src/lower.mjs",
    "src/mcp-server.mjs",
    "procedure/adapter.mjs",
  ];
  for (const file of files) {
    const text = await readFile(join(PROJECT, file), "utf8");
    assert.equal(text.includes("compareSlot"), false, `${file} must not mention compareSlot`);
    assert.equal(text.includes("has_alpha"), false, `${file} must not reimplement alpha`);
    assert.equal(text.includes("alphaPolicy"), false, `${file} must not copy alphaPolicy`);
    assert.equal(text.includes("transparencyAllowed"), false, `${file} must not copy transparency policy`);
    assert.equal(text.includes("namePattern"), false, `${file} must not copy namePattern`);
    assert.equal(text.includes("reducedRatio"), false, `${file} must not copy aspect math`);
  }
  const preflight = await readFile(join(PROJECT, "src/preflight.mjs"), "utf8");
  assert.equal(preflight.includes("loadLower"), true);
  assert.equal(preflight.includes("lower.runPreflight"), true);
  const lower = await readFile(join(PROJECT, "src/lower.mjs"), "utf8");
  assert.equal(lower.includes("Direct Runtime"), true);
  assert.match(lower, /asset-delivery-preflight\/preflight\.mjs/);
  assert.match(lower, /channel-cover-preflight\/src\/preflight\.mjs/);
});
