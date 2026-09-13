#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compareSlot } from "./compare.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..");
const CLI = join(HERE, "cli.mjs");

function runCli(spec, root) {
  return new Promise((resolve, reject) => {
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
      resolve({ code, stdout, stderr, report });
    });
  });
}

test("empty delivery against the example spec fails missing (spec drives execution before compareSlot)", async () => {
  const { code, report, stderr } = await runCli("specs/example.json", "fixtures/empty");
  assert.equal(stderr, "");
  assert.equal(code, 1);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.summary.failedIds, ["missing"]);
  assert.equal(report.checks[0].path, "slot-a.png");
  assert.equal(report.observer.capability, "org.openadam.file.inspect@0.1.0");
});

test("changing the spec slot path changes which path is reported missing", async () => {
  const { report } = await runCli("specs/example-other-path.json", "fixtures/empty");
  assert.equal(report.status, "fail");
  assert.equal(report.checks[0].path, "other.png");
});

test("compareSlot is CORE_NOT_IMPLEMENTED until the author replaces it", () => {
  assert.throws(
    () => compareSlot({ id: "slot-a" }, {}, {}),
    (error) => error && error.code === "CORE_NOT_IMPLEMENTED",
  );
});
