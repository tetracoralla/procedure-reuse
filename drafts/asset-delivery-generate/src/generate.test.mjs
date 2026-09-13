#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, link, mkdir, mkdtemp, readdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { decodePng, encodePng, paintPattern } from "./png.mjs";
import { GenerateFailure, runGenerate } from "./generate.mjs";
import { loadLower } from "./lower.mjs";
import { runGenerateThenPreflight } from "./pipeline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(HERE, "..");
const CLI = join(HERE, "cli.mjs");
const SOURCE_256 = join(PROJECT, "fixtures/source/master-256.png");
const SOURCE_32 = join(PROJECT, "fixtures/source/too-small-32.png");
const SPEC = join(PROJECT, "specs/icons.json");
const SPEC_48 = join(PROJECT, "specs/icons-64-as-48.json");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function runCli(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
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

async function tempOut(label) {
  return mkdtemp(join(tmpdir(), `asset-delivery-generate-${label}-`));
}

test("png roundtrip preserves RGB/RGBA and dimensions", () => {
  const rgba = paintPattern(12, 8, { alpha: true });
  const decoded = decodePng(encodePng(rgba));
  assert.equal(decoded.width, 12);
  assert.equal(decoded.height, 8);
  assert.equal(decoded.channels, 4);
  assert.equal(decoded.data[3], 0);
  assert.equal(decoded.data[7], 255);
  const rgb = paintPattern(10, 10, { alpha: false });
  const decodedRgb = decodePng(encodePng(rgb));
  assert.equal(decodedRgb.channels, 3);
  assert.equal(decodedRgb.width, 10);
});

test("CLI good source generates four icons and preflight passes", async () => {
  const out = await tempOut("good");
  const before = sha256(await readFile(SOURCE_256));
  const { code, report, stderr } = await runCli([
    "--source",
    SOURCE_256,
    "--spec",
    SPEC,
    "--out",
    out,
    "--compact",
  ]);
  assert.equal(stderr, "");
  assert.equal(code, 0);
  assert.equal(report.status, "pass");
  assert.equal(report.stage, "preflight");
  assert.equal(report.generate.status, "pass");
  assert.equal(report.preflight.status, "pass");
  assert.deepEqual(report.summary.failedIds, []);
  assert.equal(report.preflight.observer.capability, "org.openadam.file.inspect@0.1.0");
  assert.match(report.preflight.observer.note, /not raster.verify/i);
  assert.match(report.generator.note, /not implement org\.openadam\.raster\.prepare/i);
  assert.equal(report.generator.upscale, "forbidden");
  const names = (await readdir(out)).sort();
  assert.deepEqual(names, ["icon-128.png", "icon-16.png", "icon-32.png", "icon-64.png"]);
  const icon64 = decodePng(await readFile(join(out, "icon-64.png")));
  assert.equal(icon64.width, 64);
  assert.equal(icon64.height, 64);
  assert.equal(icon64.channels, 4);
  const after = sha256(await readFile(SOURCE_256));
  assert.equal(after, before);
  const sourceStillFile = await stat(SOURCE_256);
  assert.equal(sourceStillFile.isFile(), true);
});

test("too-small source fails at generate and does not write slots", async () => {
  const out = await tempOut("small");
  const { code, report, stderr } = await runCli([
    "--source",
    SOURCE_32,
    "--spec",
    SPEC,
    "--out",
    out,
    "--compact",
  ]);
  assert.equal(stderr, "");
  assert.equal(code, 1);
  assert.equal(report.status, "fail");
  assert.equal(report.stage, "generate");
  assert.equal(report.preflight, null);
  assert.ok(report.summary.failedIds.includes("sourceTooSmall"));
  const tooSmall = report.generate.failures.find((item) => item.id === "sourceTooSmall");
  assert.equal(tooSmall.slot, "icon-64");
  assert.equal(tooSmall.code, "SOURCE_TOO_SMALL");
  assert.match(tooSmall.message, /upscale is forbidden/i);
  assert.deepEqual(await readdir(out), []);
});

test("changing target width/height changes generated pixels and later preflight", async () => {
  const outA = await tempOut("spec-a");
  const outB = await tempOut("spec-b");
  const a = await runCli(["--source", SOURCE_256, "--spec", SPEC, "--out", outA, "--compact"]);
  const b = await runCli(["--source", SOURCE_256, "--spec", SPEC_48, "--out", outB, "--compact"]);
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  const pngA = await readFile(join(outA, "icon-64.png"));
  const pngB = await readFile(join(outB, "icon-64.png"));
  const decodedA = decodePng(pngA);
  const decodedB = decodePng(pngB);
  assert.equal(decodedA.width, 64);
  assert.equal(decodedB.width, 48);
  assert.notEqual(sha256(pngA), sha256(pngB));

  const lower = await loadLower();
  const specA = lower.loadSpec(await readFile(SPEC, "utf8"), SPEC);
  const specB = lower.loadSpec(await readFile(SPEC_48, "utf8"), SPEC_48);
  const adapter = a.report.preflight.observer.adapter;
  const againstOriginal = await lower.runPreflight({
    spec: specA,
    root: outB,
    adapter,
    workspaceRoot: outB,
  });
  assert.equal(againstOriginal.status, "fail");
  const failedIds = againstOriginal.summary.failedIds;
  assert.ok(failedIds.includes("width"));
  assert.ok(failedIds.includes("height"));
  const width = againstOriginal.checks.find((check) => !check.passed && check.id === "width");
  assert.equal(width.slot, "icon-64");
  assert.equal(width.expected, 64);
  assert.equal(width.observed, 48);
  const againstMutated = await lower.runPreflight({
    spec: specB,
    root: outB,
    adapter,
    workspaceRoot: outB,
  });
  assert.equal(againstMutated.status, "pass");
});

test("generate can succeed while reused preflight still fails (name mismatch)", async () => {
  const out = await tempOut("name");
  const lower = await loadLower();
  const spec = lower.loadSpec(await readFile(SPEC, "utf8"), SPEC);
  spec.slots[0].name = "app-icon-16.png";
  const report = await runGenerateThenPreflight({
    spec,
    source: SOURCE_256,
    out,
  });
  assert.equal(report.stage, "preflight");
  assert.equal(report.generate.status, "pass");
  assert.equal(report.status, "fail");
  assert.ok(report.summary.failedIds.includes("name"));
  const name = report.preflight.checks.find((check) => !check.passed && check.id === "name");
  assert.equal(name.slot, "icon-16");
  assert.equal(name.expected, "app-icon-16.png");
  assert.equal(name.observed, "icon-16.png");
});

test("unsupported JPEG slot fails at generate, not preflight", async () => {
  const out = await tempOut("jpeg");
  const lower = await loadLower();
  const spec = lower.parseSpec(
    {
      id: "jpeg-slot",
      version: "0.1.0",
      slots: [
        {
          id: "hero",
          path: "hero.jpg",
          name: "hero.jpg",
          format: "jpeg",
          width: 64,
          height: 64,
          alpha: "any",
          required: true,
        },
      ],
    },
    "inline-jpeg",
  );
  const report = await runGenerateThenPreflight({ spec, source: SOURCE_256, out, generateOnly: true });
  assert.equal(report.stage, "generate");
  assert.equal(report.status, "fail");
  assert.ok(report.summary.failedIds.includes("slotFormatUnsupported"));
  assert.equal(report.preflight, null);
});

test("refusing to overwrite existing slot files is a generate failure", async () => {
  const out = await tempOut("exists");
  const first = await runCli(["--source", SOURCE_256, "--spec", SPEC, "--out", out, "--compact"]);
  assert.equal(first.code, 0);
  const second = await runCli(["--source", SOURCE_256, "--spec", SPEC, "--out", out, "--compact"]);
  assert.equal(second.code, 1);
  assert.equal(second.report.stage, "generate");
  assert.ok(second.report.summary.failedIds.includes("outputExists"));
  const third = await runCli([
    "--source",
    SOURCE_256,
    "--spec",
    SPEC,
    "--out",
    out,
    "--overwrite",
    "--compact",
  ]);
  assert.equal(third.code, 0);
  assert.equal(third.report.stage, "preflight");
});

test("does not copy preflight comparison; imports runPreflight", async () => {
  const files = await Promise.all(
    ["generate.mjs", "pipeline.mjs", "lower.mjs", "cli.mjs", "png.mjs"].map((name) =>
      readFile(join(HERE, name), "utf8"),
    ),
  );
  const src = files.join("\n");
  assert.doesNotMatch(src, /function compareSlot/);
  assert.doesNotMatch(src, /alphaPassed/);
  assert.doesNotMatch(src, /alphaPolicy/);
  assert.doesNotMatch(src, /namePattern/);
  assert.doesNotMatch(src, /transparencyAllowed/);
  assert.match(src, /runPreflight/);
  assert.match(src, /loadLower/);
  assert.match(src, /Does not implement org\.openadam\.raster\.prepare/);
  assert.match(src, /Does not bind asset-prep/);
  assert.doesNotMatch(src, /from ["'].*asset-prep/);
  assert.doesNotMatch(src, /raster\.prepare["']/);
});

function twoSlotSpec(paths) {
  return {
    id: "write-boundary",
    version: "0.1.0",
    slots: paths.map((path, index) => ({
      id: `slot-${index}`,
      path,
      name: path.split("/").at(-1),
      format: "png",
      width: 16,
      height: 16,
      alpha: "any",
      required: true,
    })),
  };
}

async function parseInline(spec) {
  const lower = await loadLower();
  return lower.parseSpec(spec, "inline-write-boundary");
}

test("legacy string dest===sourcePath misses directory-alias overwrite (reviewer case)", async () => {
  const work = await tempOut("legacy-alias");
  const realDir = join(work, "real");
  await mkdir(realDir);
  const source = join(realDir, "master.png");
  const sourceBytes = encodePng(paintPattern(32, 32, { alpha: true }));
  await writeFile(source, sourceBytes);
  const alias = join(work, "alias");
  await symlink(realDir, alias);
  const dest = join(alias, "master.png");
  const sourcePath = source;
  assert.notEqual(dest, sourcePath);
  const before = sha256(sourceBytes);
  await writeFile(dest, Buffer.from("not-a-png"));
  assert.notEqual(sha256(await readFile(source)), before);
});

test("directory alias of the source directory cannot be used to overwrite the source", async () => {
  const work = await tempOut("alias-src");
  const realDir = join(work, "real");
  await mkdir(realDir);
  const source = join(realDir, "master.png");
  const sourceBytes = encodePng(paintPattern(32, 32, { alpha: true }));
  await writeFile(source, sourceBytes);
  const alias = join(work, "alias");
  await symlink(realDir, alias);
  const spec = await parseInline(twoSlotSpec(["master.png"]));
  await assert.rejects(
    () => runGenerate({ spec, source, out: alias, overwrite: true }),
    (error) => error instanceof GenerateFailure && error.failures[0].id === "sourceWouldBeOverwritten",
  );
  assert.equal(sha256(await readFile(source)), sha256(sourceBytes));
});

test("hard link alias of the source cannot be overwritten", async () => {
  const work = await tempOut("hardlink");
  const source = join(work, "master.png");
  const sourceBytes = encodePng(paintPattern(32, 32, { alpha: true }));
  await writeFile(source, sourceBytes);
  const out = join(work, "out");
  await mkdir(out);
  await link(source, join(out, "icon.png"));
  const spec = await parseInline(twoSlotSpec(["icon.png"]));
  await assert.rejects(
    () => runGenerate({ spec, source, out, overwrite: true }),
    (error) => error instanceof GenerateFailure && error.failures[0].code === "SOURCE_PRESERVE",
  );
  assert.equal(sha256(await readFile(source)), sha256(sourceBytes));
});

test("legacy writeFile follows a dangling dest symlink outside the output root (reviewer case)", async () => {
  const work = await tempOut("legacy-dangle");
  const out = join(work, "out");
  await mkdir(out);
  const outside = join(work, "outside", "leaked.png");
  await mkdir(join(work, "outside"));
  await symlink(outside, join(out, "icon.png"));
  await writeFile(join(out, "icon.png"), Buffer.from("leaked"));
  assert.equal(await readFile(outside, "utf8"), "leaked");
});

test("dangling dest symlink is not followed; default mode does not create files outside --out", async () => {
  const work = await tempOut("dangle");
  const out = join(work, "out");
  await mkdir(out);
  const outside = join(work, "outside", "leaked.png");
  await mkdir(join(work, "outside"));
  await symlink(outside, join(out, "icon.png"));
  const source = join(work, "master.png");
  await writeFile(source, encodePng(paintPattern(32, 32, { alpha: true })));
  const spec = await parseInline(twoSlotSpec(["icon.png"]));
  await assert.rejects(
    () => runGenerate({ spec, source, out, overwrite: false }),
    (error) => error instanceof GenerateFailure && error.failures[0].id === "outputExists",
  );
  await assert.rejects(readFile(outside), (error) => error && error.code === "ENOENT");
  const overwritten = await runGenerate({ spec, source, out, overwrite: true });
  assert.equal(overwritten.status, "pass");
  await assert.rejects(readFile(outside), (error) => error && error.code === "ENOENT");
  const written = decodePng(await readFile(join(out, "icon.png")));
  assert.equal(written.width, 16);
});

test("intermediate output symlink cannot expand the write root", async () => {
  const work = await tempOut("mid-link");
  const out = join(work, "out");
  await mkdir(out);
  const outside = join(work, "outside");
  await mkdir(outside);
  await symlink(outside, join(out, "nested"));
  const source = join(work, "master.png");
  await writeFile(source, encodePng(paintPattern(32, 32, { alpha: true })));
  const spec = await parseInline(twoSlotSpec(["nested/icon.png"]));
  await assert.rejects(
    () => runGenerate({ spec, source, out, overwrite: true }),
    (error) => error instanceof GenerateFailure && error.failures[0].id === "pathEscape",
  );
  const names = await readdir(outside);
  assert.deepEqual(names, []);
});

test("second-slot I/O failure reports the first file as partial output", async () => {
  const work = await tempOut("partial");
  const out = join(work, "out");
  await mkdir(out);
  const locked = join(out, "locked");
  await mkdir(locked);
  await chmod(locked, 0o555);
  const source = join(work, "master.png");
  await writeFile(source, encodePng(paintPattern(32, 32, { alpha: true })));
  const spec = await parseInline(twoSlotSpec(["first.png", "locked/second.png"]));
  try {
    await runGenerate({ spec, source, out });
    assert.fail("expected GenerateFailure");
  } catch (error) {
    assert.equal(error instanceof GenerateFailure, true);
    assert.equal(error.output.partial, true);
    assert.equal(error.output.written.length, 1);
    assert.equal(error.output.written[0].path, "first.png");
    assert.equal(error.failures[0].id, "writeFailed");
    const names = (await readdir(out)).sort();
    assert.ok(names.includes("first.png"));
    assert.deepEqual(await readdir(locked), []);
  } finally {
    await chmod(locked, 0o755);
  }
});

test("opaque source cannot satisfy alpha=present slots", async () => {
  const out = await tempOut("opaque");
  const opaque = join(out, "opaque.png");
  await writeFile(opaque, encodePng(paintPattern(128, 128, { alpha: false })));
  const delivery = join(out, "delivery");
  const { code, report } = await runCli([
    "--source",
    opaque,
    "--spec",
    SPEC,
    "--out",
    delivery,
    "--compact",
  ]);
  assert.equal(code, 1);
  assert.equal(report.stage, "generate");
  assert.ok(report.summary.failedIds.includes("sourceAlphaMissing"));
});
