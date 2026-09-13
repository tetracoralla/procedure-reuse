#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const PREFLIGHT = join(HERE, "preflight.mjs");

function runPreflight(spec, root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PREFLIGHT, "--spec", spec, "--root", root, "--compact"], {
      cwd: HERE,
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
      resolve({ code, stdout, stderr, report });
    });
  });
}

function failedIds(report) {
  return [...new Set((report.checks ?? []).filter((check) => !check.passed).map((check) => check.id))];
}

test("good fixture passes the delivery spec", async () => {
  const { code, report, stderr } = await runPreflight("specs/good.json", "fixtures/good");
  assert.equal(stderr, "");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.failed, 0);
  assert.deepEqual(report.summary.failedIds, []);
});

test("good-alt fixture still passes the same spec", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/good-alt");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
});

test("wrong-size fixture fails width and height", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/wrong-size");
  assert.equal(code, 1);
  assert.equal(report.status, "fail");
  const ids = failedIds(report);
  assert.ok(ids.includes("width"));
  assert.ok(ids.includes("height"));
  const width = report.checks.find((check) => !check.passed && check.id === "width");
  assert.equal(width.slot, "icon-64");
  assert.equal(width.expected, 64);
  assert.equal(width.observed, 48);
});

test("wrong-format fixture fails format", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/wrong-format");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("format"));
  const format = report.checks.find((check) => !check.passed && check.id === "format");
  assert.equal(format.slot, "wordmark");
  assert.equal(format.expected, "png");
  assert.equal(format.observed, "jpeg");
});

test("wrong-alpha fixture fails alpha", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/wrong-alpha");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("alpha"));
  const alpha = report.checks.find((check) => !check.passed && check.id === "alpha");
  assert.equal(alpha.slot, "wordmark");
  assert.equal(alpha.expected, "absent");
  assert.equal(alpha.observed, "present");
});

test("missing-slot fixture fails missing", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/missing-slot");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.deepEqual(ids, ["missing"]);
  const missing = report.checks.find((check) => check.id === "missing");
  assert.equal(missing.slot, "icon-128");
  assert.equal(missing.passed, false);
});

test("extra-file fixture fails extra", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/extra-file");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.deepEqual(ids, ["extra"]);
  const extra = report.checks.find((check) => check.id === "extra");
  assert.equal(extra.observed, "scratch-icon.png");
});

test("wrong-name on disk against the good spec is missing plus extra", async () => {
  const { code, report } = await runPreflight("specs/good.json", "fixtures/bad/wrong-name");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("missing"));
  assert.ok(ids.includes("extra"));
});

test("wrong-name spec against the renamed file fails name", async () => {
  const { code, report } = await runPreflight("specs/wrong-name.json", "fixtures/bad/wrong-name");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.deepEqual(ids, ["name"]);
  const name = report.checks.find((check) => !check.passed && check.id === "name");
  assert.equal(name.slot, "icon-16");
  assert.equal(name.expected, "icon-16.png");
  assert.equal(name.observed, "icon16.png");
});

test("changing expected height on the same good files flips pass to fail", async () => {
  const good = await runPreflight("specs/good.json", "fixtures/good");
  const mutated = await runPreflight("specs/good-wrong-height.json", "fixtures/good");
  assert.equal(good.code, 0);
  assert.equal(mutated.code, 1);
  const height = mutated.report.checks.find((check) => !check.passed && check.id === "height");
  assert.equal(height.slot, "og-cover");
  assert.equal(height.expected, 361);
  assert.equal(height.observed, 360);
});

test("name-mismatch spec against good files fails name", async () => {
  const { code, report } = await runPreflight("specs/name-mismatch.json", "fixtures/good");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.deepEqual(ids, ["name"]);
});
