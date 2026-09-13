#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { adapterTest } from "../../../scripts/lib/file-vitals-adapter.mjs";
import { inspectPathForGrant, resolveAdapter } from "../lib/observe-file-inspect.mjs";
import { loadSpec, runPreflight as runPreflightLib } from "./preflight.mjs";

const whenAdapter = adapterTest(test);

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

function failedIds(report) {
  return [...new Set((report.checks ?? []).filter((check) => !check.passed).map((check) => check.id))];
}

whenAdapter("good fixture passes the channel-cover spec including absent optional 4x5", async () => {
  const { code, report, stderr } = await runCli("specs/good.json", "fixtures/good");
  assert.equal(stderr, "");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.failed, 0);
  assert.deepEqual(report.summary.failedIds, []);
  const optional = report.slots.find((slot) => slot.id === "cover-4x5");
  assert.equal(optional.present, false);
  assert.equal(optional.required, false);
  assert.equal(report.observer.capability, "org.openadam.file.inspect@0.1.0");
  assert.match(report.observer.note, /not raster.verify/i);
});

whenAdapter("good-alt still passes the same spec", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/good-alt");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
});

whenAdapter("wrong-size 16x9 fails height and aspect", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/wrong-size");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("height"));
  assert.ok(ids.includes("aspect"));
  const height = report.checks.find((check) => !check.passed && check.id === "height");
  assert.equal(height.slot, "cover-16x9");
  assert.equal(height.expected, 90);
  assert.equal(height.observed, 80);
  const aspect = report.checks.find((check) => !check.passed && check.id === "aspect");
  assert.equal(aspect.expected, "16:9");
  assert.equal(aspect.observed, "2:1");
});

whenAdapter("wrong-format 16x9 (PNG bytes named .jpg) fails format", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/wrong-format");
  assert.equal(code, 1);
  const format = report.checks.find((check) => !check.passed && check.id === "format");
  assert.equal(format.slot, "cover-16x9");
  assert.equal(format.expected, "jpeg");
  assert.equal(format.observed, "png");
});

whenAdapter("transparent 1x1 fails transparency when not allowed", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/transparent");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.deepEqual(ids, ["transparency"]);
  const alpha = report.checks.find((check) => !check.passed && check.id === "transparency");
  assert.equal(alpha.slot, "cover-1x1");
  assert.equal(alpha.expected, "forbidden");
  assert.equal(alpha.observed, "present");
});

whenAdapter("same transparent fixture passes when the spec allows transparency", async () => {
  const forbidden = await runCli("specs/good.json", "fixtures/bad/transparent");
  const allowed = await runCli("specs/transparency-allowed.json", "fixtures/bad/transparent");
  assert.equal(forbidden.code, 1);
  assert.equal(allowed.code, 0);
  assert.equal(allowed.report.status, "pass");
});

whenAdapter("missing required 9x16 fails missing; optional 4x5 absence is not missing", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/missing-slot");
  assert.equal(code, 1);
  assert.deepEqual(failedIds(report), ["missing"]);
  const missing = report.checks.find((check) => check.id === "missing");
  assert.equal(missing.slot, "cover-9x16");
});

whenAdapter("extra undeclared file fails extra", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/extra-file");
  assert.equal(code, 1);
  assert.deepEqual(failedIds(report), ["extra"]);
  const extra = report.checks.find((check) => check.id === "extra");
  assert.equal(extra.observed, "covers/scratch-cover.png");
});

whenAdapter("wrong-name on disk against the good spec is missing plus extra", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/wrong-name");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("missing"));
  assert.ok(ids.includes("extra"));
});

whenAdapter("changing expected width on the same good files flips pass to fail", async () => {
  const good = await runCli("specs/good.json", "fixtures/good");
  const mutated = await runCli("specs/good-wrong-width.json", "fixtures/good");
  assert.equal(good.code, 0);
  assert.equal(mutated.code, 1);
  const width = mutated.report.checks.find((check) => !check.passed && check.id === "width");
  assert.equal(width.slot, "cover-1x1");
  assert.equal(width.expected, 65);
  assert.equal(width.observed, 64);
});

whenAdapter("changing expected aspect on the same good files fails only aspect", async () => {
  const mutated = await runCli("specs/good-wrong-aspect.json", "fixtures/good");
  assert.equal(mutated.code, 1);
  assert.deepEqual(failedIds(mutated.report), ["aspect"]);
  const aspect = mutated.report.checks.find((check) => !check.passed && check.id === "aspect");
  assert.equal(aspect.slot, "cover-16x9");
  assert.equal(aspect.expected, "4:3");
  assert.equal(aspect.observed, "16:9");
});

whenAdapter("changing naming.pattern on the same good files fails namePattern", async () => {
  const mutated = await runCli("specs/good-wrong-pattern.json", "fixtures/good");
  assert.equal(mutated.code, 1);
  assert.deepEqual(failedIds(mutated.report), ["namePattern"]);
});

whenAdapter("wrong-aspect fixture (160x100) fails height and aspect", async () => {
  const { code, report } = await runCli("specs/good.json", "fixtures/bad/wrong-aspect");
  assert.equal(code, 1);
  const ids = failedIds(report);
  assert.ok(ids.includes("height"));
  assert.ok(ids.includes("aspect"));
  const aspect = report.checks.find((check) => !check.passed && check.id === "aspect");
  assert.equal(aspect.expected, "16:9");
  assert.equal(aspect.observed, "8:5");
});

test("inspect path is relative to the delivery root, not a parent workspace grant", () => {
  assert.equal(
    inspectPathForGrant("/grant", "/grant/delivery", "covers/cover-1x1.png"),
    "delivery/covers/cover-1x1.png",
  );
});

whenAdapter("same-named cover in workspaceRoot is ignored; delivery root is inspected", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "channel-cover-path-"));
  const delivery = join(tmp, "delivery");
  await mkdir(join(delivery, "covers"), { recursive: true });
  await mkdir(join(tmp, "covers"), { recursive: true });
  await copyFile(join(PROJECT, "fixtures/good/covers/cover-1x1.png"), join(delivery, "covers/cover-1x1.png"));
  await copyFile(join(PROJECT, "fixtures/bad/wrong-size/covers/cover-1x1.png"), join(tmp, "covers/cover-1x1.png"));
  const spec = loadSpec(
    JSON.stringify({
      id: "one",
      version: "0.1.0",
      family: "channel-cover",
      naming: { pattern: "^cover-(1x1|16x9|9x16|4x5)\\.(png|jpe?g)$" },
      transparencyAllowed: false,
      slots: [
        {
          id: "cover-1x1",
          path: "covers/cover-1x1.png",
          aspect: "1:1",
          format: "png",
          width: 64,
          height: 64,
          required: true,
        },
      ],
    }),
    "inline-one",
  );
  const adapter = await resolveAdapter(undefined, { projectRoot: PROJECT });
  const report = await runPreflightLib({
    spec,
    root: delivery,
    adapter,
    workspaceRoot: tmp,
  });
  assert.equal(report.status, "pass");
  const width = report.checks.find((check) => check.id === "width");
  assert.equal(width.observed, 64);
});
