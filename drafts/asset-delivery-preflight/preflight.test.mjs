#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  inspectPathForGrant,
  parseSpec,
  resolveAdapter,
  runPreflight as runPreflightLib,
} from "./preflight.mjs";

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

test("inspect path is delivery-relative, not workspaceRoot-relative", () => {
  const grant = "/grant";
  const delivery = "/grant/delivery";
  assert.equal(inspectPathForGrant(grant, delivery, "icon-16.png"), "delivery/icon-16.png");
  assert.equal(inspectPathForGrant(delivery, delivery, "icon-16.png"), "icon-16.png");
});

const FAKE_ADAPTER = `#!/usr/bin/env node
import { createInterface } from "node:readline";
import { basename } from "node:path";
const table = JSON.parse(process.env.FAKE_INSPECT_TABLE || "{}");
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  const req = JSON.parse(line);
  const path = req.input?.path ?? "";
  const canned = table[path] ?? table[basename(path)];
  if (!canned) {
    process.stdout.write(JSON.stringify({ id: req.id, ok: false, error: { code: "NOT_FOUND", message: path } }) + "\\n");
    continue;
  }
  process.stdout.write(JSON.stringify({ id: req.id, ok: true, result: canned }) + "\\n");
}
`;

function pngResult(overrides = {}) {
  return {
    status: "ok",
    file: { name: "icon-16.png", size_bytes: 80, extension: ".png" },
    identity: {
      kind: "image",
      media_type: "image/png",
      format: "PNG",
      confidence: "exact",
      extension_match: true,
      candidates: [],
      conflicts: [],
    },
    traits: [],
    constraints: [],
    integrity: { readable: true, parseable: true },
    image: { width: 16, height: 16, bit_depth: 8, color_model: "nrgba", has_alpha: true },
    diagnostics: [],
    ...overrides,
  };
}

function oneSlotSpec() {
  return parseSpec(
    {
      id: "one",
      version: "0.1.0",
      slots: [
        {
          id: "icon-16",
          path: "icon-16.png",
          name: "icon-16.png",
          format: "png",
          width: 16,
          height: 16,
          alpha: "present",
          required: true,
        },
      ],
    },
    "inline-one",
  );
}

async function withFakeAdapter(table, fn) {
  const tmp = await mkdtemp(join(tmpdir(), "asset-delivery-preflight-fake-"));
  const dir = join(tmp, "delivery");
  await mkdir(dir);
  const adapter = join(tmp, "fake-adapter.mjs");
  await writeFile(adapter, FAKE_ADAPTER);
  await chmod(adapter, 0o755);
  await writeFile(join(dir, "icon-16.png"), Buffer.from("not-inspected"));
  const previous = process.env.FAKE_INSPECT_TABLE;
  process.env.FAKE_INSPECT_TABLE = JSON.stringify(table);
  try {
    return await fn({ dir, adapter });
  } finally {
    if (previous === undefined) {
      delete process.env.FAKE_INSPECT_TABLE;
    } else {
      process.env.FAKE_INSPECT_TABLE = previous;
    }
  }
}

test("same-named file in workspaceRoot is ignored; delivery root is inspected", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "asset-delivery-preflight-path-"));
  const delivery = join(tmp, "delivery");
  await mkdir(delivery);
  await copyFile(join(HERE, "fixtures/good/icon-16.png"), join(delivery, "icon-16.png"));
  await copyFile(join(HERE, "fixtures/good/icon-32.png"), join(tmp, "icon-16.png"));
  const adapter = await resolveAdapter();
  const report = await runPreflightLib({
    spec: oneSlotSpec(),
    root: delivery,
    adapter,
    workspaceRoot: tmp,
  });
  assert.equal(report.status, "pass");
  const width = report.checks.find((check) => check.id === "width");
  assert.equal(width.observed, 16);
  assert.equal(width.passed, true);
});

test("corrupt inspect status fails the suite even when width/height would match", async () => {
  await withFakeAdapter(
    { "icon-16.png": pngResult({ status: "corrupt" }) },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "fail");
      assert.ok(report.summary.failedIds.includes("inspectStatus"));
      const status = report.checks.find((check) => check.id === "inspectStatus");
      assert.equal(status.observed, "corrupt");
      assert.equal(status.passed, false);
    },
  );
});

test("unsupported inspect status is not a silent pass", async () => {
  await withFakeAdapter(
    { "icon-16.png": pngResult({ status: "unsupported", image: undefined, identity: { kind: "unknown", media_type: "application/octet-stream", format: "Unknown", confidence: "unknown", extension_match: false, candidates: [], conflicts: [] } }) },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "fail");
      assert.ok(report.summary.failedIds.includes("inspectStatus"));
    },
  );
});

test("partial observation with usable fields can still pass", async () => {
  await withFakeAdapter(
    { "icon-16.png": pngResult({ status: "partial" }) },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "pass");
      const status = report.checks.find((check) => check.id === "inspectStatus");
      assert.equal(status.observed, "partial");
      assert.equal(status.passed, true);
    },
  );
});

test("partial observation missing width fails that check, not by ignoring status", async () => {
  await withFakeAdapter(
    { "icon-16.png": pngResult({ status: "partial", image: { height: 16, has_alpha: true } }) },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "fail");
      assert.ok(report.summary.failedIds.includes("width"));
      const status = report.checks.find((check) => check.id === "inspectStatus");
      assert.equal(status.passed, true);
    },
  );
});

test("unreadable integrity fails inspectIntegrity", async () => {
  await withFakeAdapter(
    { "icon-16.png": pngResult({ integrity: { readable: false, parseable: false } }) },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "fail");
      assert.ok(report.summary.failedIds.includes("inspectIntegrity"));
    },
  );
});

test("error diagnostic is a failed inspectDiagnostic, not a silent pass", async () => {
  await withFakeAdapter(
    {
      "icon-16.png": pngResult({
        diagnostics: [{ code: "PROBE_FAILED", severity: "error", message: "image probe failed" }],
      }),
    },
    async ({ dir, adapter }) => {
      const report = await runPreflightLib({
        spec: oneSlotSpec(),
        root: dir,
        adapter,
        workspaceRoot: dir,
      });
      assert.equal(report.status, "fail");
      assert.ok(report.summary.failedIds.includes("inspectDiagnostic"));
    },
  );
});
