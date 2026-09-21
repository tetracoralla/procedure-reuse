#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT = join(HERE, "..");
const PREFLIGHT = join(DRAFT, "preflight.mjs");

const cases = [
  { name: "good", spec: "specs/good.json", root: "fixtures/good", expect: "pass" },
  { name: "good-alt", spec: "specs/good.json", root: "fixtures/good-alt", expect: "pass" },
  { name: "wrong-size", spec: "specs/good.json", root: "fixtures/bad/wrong-size", expect: "fail" },
  { name: "wrong-format", spec: "specs/good.json", root: "fixtures/bad/wrong-format", expect: "fail" },
  { name: "wrong-alpha", spec: "specs/good.json", root: "fixtures/bad/wrong-alpha", expect: "fail" },
  { name: "missing-slot", spec: "specs/good.json", root: "fixtures/bad/missing-slot", expect: "fail" },
  { name: "extra-file", spec: "specs/good.json", root: "fixtures/bad/extra-file", expect: "fail" },
  { name: "wrong-name-as-missing-extra", spec: "specs/good.json", root: "fixtures/bad/wrong-name", expect: "fail" },
  { name: "wrong-name-located", spec: "specs/wrong-name.json", root: "fixtures/bad/wrong-name", expect: "fail" },
  { name: "spec-height-edit", spec: "specs/good-wrong-height.json", root: "fixtures/good", expect: "fail" },
  { name: "spec-name-edit", spec: "specs/name-mismatch.json", root: "fixtures/good", expect: "fail" },
];

function run(spec, root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PREFLIGHT, "--spec", spec, "--root", root, "--compact"], {
      cwd: DRAFT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
  });
}

function compactFailed(report) {
  return (report.checks ?? [])
    .filter((check) => !check.passed)
    .map((check) => ({
      id: check.id,
      slot: check.slot ?? null,
      path: check.path ?? null,
      expected: check.expected,
      observed: check.observed,
    }));
}

const rows = [];
let failed = 0;
for (const item of cases) {
  const result = await run(item.spec, item.root);
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = { status: "unparseable", error: result.stderr || result.stdout };
  }
  const ok = item.expect === "pass" ? result.code === 0 && report.status === "pass" : result.code === 1 && report.status === "fail";
  if (!ok) {
    failed += 1;
  }
  rows.push({
    name: item.name,
    spec: item.spec,
    root: item.root,
    expect: item.expect,
    status: report.status,
    exit: result.code,
    failedIds: report.summary?.failedIds ?? [],
    failedChecks: compactFailed(report),
    ok,
    stderr: result.stderr,
  });
}

process.stdout.write(`${JSON.stringify({ ok: failed === 0, cases: rows }, null, 2)}\n`);
process.exit(failed === 0 ? 0 : 1);
