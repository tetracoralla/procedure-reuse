#!/usr/bin/env node
/**
 * Cold-reader drill for M4. Follows HANDOFF.md commands against new tasks.
 * Does not import Host. Does not treat call counts as value.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");
const WORKSPACE = resolve(PROJECT, "../..");
const CLI = join(PROJECT, "src/cli.mjs");
const OBS = join(HERE, "observations");

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  return {
    command: [command, ...args].join(" "),
    cwd,
    code: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ? result.error.message : null,
  };
}

function runCli(spec, root, cwd = PROJECT) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI, "--spec", spec, "--root", root, "--compact"], {
      cwd,
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
      resolvePromise({
        command: `node src/cli.mjs --spec ${spec} --root ${root} --compact`,
        cwd,
        node: process.execPath,
        code,
        stdout,
        stderr,
        report,
      });
    });
  });
}

async function walkFiles(root, acc = []) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

async function sha256(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

function summarize(run) {
  const report = run.report;
  if (!report) {
    return {
      code: run.code,
      parse: false,
      stderr: run.stderr.trim(),
    };
  }
  return {
    code: run.code,
    parse: true,
    status: report.status,
    failedKits: report.summary?.failedKits ?? [],
    failedIds: report.summary?.failedIds ?? [],
    kits: (report.kits ?? []).map((kit) => ({
      id: kit.id,
      kind: kit.kind,
      present: kit.present,
      status: kit.status,
      failedIds: kit.summary?.failedIds ?? [],
      workspaceRoot: kit.workspaceRoot,
    })),
    observer: report.observer?.capability ?? null,
  };
}

function expectMatch(got, expect) {
  const failedKits = got.failedKits ?? [];
  const failedIds = new Set(got.failedIds ?? []);
  const kitsOk = JSON.stringify(failedKits) === JSON.stringify(expect.failedKits);
  const idsOk = (expect.failedIds ?? []).every((id) => failedIds.has(id));
  const extraOk = expect.failedIds
    ? [...failedIds].every((id) => expect.failedIds.includes(id))
    : true;
  return got.status === expect.status && kitsOk && idsOk && extraOk;
}

const blockers = [];
const edits = [];
const questions = [];

async function main() {
  await mkdir(OBS, { recursive: true });

  const nodeVersion = runCapture(process.execPath, ["-v"], PROJECT);
  const whichNode = runCapture("sh", ["-c", "command -v node; node -v || true"], PROJECT);
  const systemNode = runCapture("sh", ["-c", "command -v node; node -v"], WORKSPACE);
  const adapterPath = join(PROJECT, "bin/capability-adapter");
  let adapterOk = false;
  try {
    const info = await stat(adapterPath);
    adapterOk = info.isFile();
  } catch {
    adapterOk = false;
  }

  if (!adapterOk) {
    blockers.push({
      id: "adapter-missing",
      during: "first-run",
      note: "bin/capability-adapter missing; HANDOFF says run scripts/build-file-vitals.sh",
    });
    const built = spawnSync("sh", ["scripts/build-file-vitals.sh"], {
      cwd: PROJECT,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(WORKSPACE, ".tools/go/bin")}:${process.env.PATH ?? ""}`,
      },
    });
    edits.push({
      id: "build-adapter",
      files: 0,
      note: `ran scripts/build-file-vitals.sh exit=${built.status}`,
    });
  }

  const naiveShortPaths = await runCli(
    "handoff/tasks/kiosk-badge/campaign.json",
    "handoff/tasks/kiosk-badge/delivery",
    WORKSPACE,
  );
  const naiveWorkspaceCwd = await runCli(
    "drafts/batch-delivery-preflight/handoff/tasks/kiosk-badge/campaign.json",
    "drafts/batch-delivery-preflight/handoff/tasks/kiosk-badge/delivery",
    WORKSPACE,
  );
  if (naiveShortPaths.code !== 0) {
    questions.push({
      id: "cwd-short-paths",
      asked: "Can I paste HANDOFF --spec/--root paths from the workspace root?",
      answer: "No. HANDOFF requires cd into drafts/batch-delivery-preflight (or absolute/long paths). Short paths from the workspace root miss the spec file.",
    });
  }
  if (naiveWorkspaceCwd.code === 0 && naiveWorkspaceCwd.report?.status === "pass") {
    questions.push({
      id: "cwd-workspace-root",
      asked: "Can I run from the workspace root with long relative paths?",
      answer: "Yes if --spec/--root are correct; adapter still resolves from the CLI file location.",
    });
  } else {
    blockers.push({
      id: "cwd-workspace-root",
      during: "naive",
      note: `workspace-root cwd failed: code=${naiveWorkspaceCwd.code} stderr=${naiveWorkspaceCwd.stderr.trim()}`,
    });
  }

  const smoke = await runCli("specs/good.json", "fixtures/good");
  const taskA = JSON.parse(await readFile(join(HERE, "tasks/kiosk-badge/task.json"), "utf8"));
  const taskB = JSON.parse(await readFile(join(HERE, "tasks/docs-social/task.json"), "utf8"));

  const runA = await runCli(
    "handoff/tasks/kiosk-badge/campaign.json",
    "handoff/tasks/kiosk-badge/delivery",
  );
  const runB = await runCli(
    "handoff/tasks/docs-social/campaign.json",
    "handoff/tasks/docs-social/delivery",
  );
  const runBFix = await runCli(
    "handoff/tasks/docs-social/campaign.json",
    "handoff/tasks/docs-social/delivery-fixed",
  );

  const sumA = summarize(runA);
  const sumB = summarize(runB);
  const sumBFix = summarize(runBFix);
  const sumSmoke = summarize(smoke);

  const aOk = expectMatch(sumA, taskA.expect);
  const bOk = expectMatch(sumB, taskB.expect);
  const bFixOk = expectMatch(sumBFix, taskB.fix.expect);

  if (!aOk) {
    blockers.push({
      id: "task-kiosk-badge",
      during: "handoff-command",
      note: `expected ${JSON.stringify(taskA.expect)} got ${JSON.stringify(sumA)}`,
    });
  }
  if (!bOk) {
    blockers.push({
      id: "task-docs-social-broken",
      during: "handoff-command",
      note: `expected ${JSON.stringify(taskB.expect)} got ${JSON.stringify(sumB)}`,
    });
  }
  if (!bFixOk) {
    blockers.push({
      id: "task-docs-social-fixed",
      during: "fix",
      note: `expected ${JSON.stringify(taskB.fix.expect)} got ${JSON.stringify(sumBFix)}`,
    });
  } else {
    edits.push({
      id: "replace-card-wide-jpeg",
      files: 1,
      note: "Replaced card-wide.jpg 176x100 with 176x99. Specs unchanged. Optional card-portrait still absent.",
    });
  }

  const authorGood = await walkFiles(join(PROJECT, "fixtures/good"));
  const lowerGood = [
    ...(await walkFiles(join(PROJECT, "../asset-delivery-preflight/fixtures/good"))),
    ...(await walkFiles(join(PROJECT, "../channel-cover-preflight/fixtures/good"))),
  ];
  const authorHashes = new Set();
  for (const file of [...authorGood, ...lowerGood]) {
    if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")) {
      authorHashes.add(await sha256(file));
    }
  }
  const newPixels = [
    ...(await walkFiles(join(HERE, "tasks/kiosk-badge/delivery"))),
    ...(await walkFiles(join(HERE, "tasks/docs-social/delivery"))),
    ...(await walkFiles(join(HERE, "tasks/docs-social/delivery-fixed"))),
  ].filter((file) => file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg"));
  const overlap = [];
  const newHashes = [];
  for (const file of newPixels) {
    const digest = await sha256(file);
    newHashes.push({ file: file.slice(PROJECT.length + 1), sha256: digest });
    if (authorHashes.has(digest)) {
      overlap.push(file.slice(PROJECT.length + 1));
    }
  }
  if (overlap.length > 0) {
    blockers.push({
      id: "copied-good-pixels",
      during: "uniqueness",
      note: `new task files share sha256 with author fixtures: ${overlap.join(", ")}`,
    });
  }

  const kitA = runA.report?.kits ?? [];
  const grantNote = kitA.map((kit) => ({
    id: kit.id,
    workspaceRoot: kit.workspaceRoot,
    campaignRoot: runA.report?.root,
    grantIsKitRoot: typeof kit.workspaceRoot === "string" && kit.workspaceRoot.endsWith(`/${kit.id}`),
  }));

  const record = {
    generatedAt: new Date().toISOString(),
    followed: "HANDOFF.md shortest commands from drafts/batch-delivery-preflight",
    hostImport: false,
    environment: {
      execPath: process.execPath,
      execVersion: nodeVersion.stdout.trim(),
      whichNode: whichNode.stdout.trim(),
      systemNode: systemNode.stdout.trim(),
      adapterPresent: adapterOk,
      adapterPath: adapterPath,
    },
    uniqueness: {
      newPixelCount: newPixels.length,
      overlapWithAuthorGood: overlap,
    },
    inspectGrants: grantNote,
    smokeAuthorGood: sumSmoke,
    tasks: [
      { id: "kiosk-badge", ok: aOk, expect: taskA.expect, got: sumA, whyDifferent: taskA.whyDifferent },
      { id: "docs-social-broken", ok: bOk, expect: taskB.expect, got: sumB, whyDifferent: taskB.whyDifferent },
      { id: "docs-social-fixed", ok: bFixOk, expect: taskB.fix.expect, got: sumBFix, fix: taskB.fix.note },
    ],
    naive: {
      shortPathsFromWorkspaceRoot: {
        code: naiveShortPaths.code,
        stderr: naiveShortPaths.stderr.trim().split("\n").slice(-3).join("\n"),
        status: naiveShortPaths.report?.status ?? null,
      },
      workspaceCwd: {
        code: naiveWorkspaceCwd.code,
        stderr: naiveWorkspaceCwd.stderr.trim(),
        status: naiveWorkspaceCwd.report?.status ?? null,
      },
    },
    blockers,
    edits,
    questions,
    newFileHashes: newHashes,
  };

  const jsonPath = join(OBS, "drill.json");
  await writeFile(jsonPath, `${JSON.stringify(record, null, 2)}\n`);

  const lines = [];
  lines.push("# Cold-reader drill log");
  lines.push("");
  lines.push(`Generated: ${record.generatedAt}`);
  lines.push("Followed: `HANDOFF.md` shortest commands from `drafts/batch-delivery-preflight/`.");
  lines.push("Host import: not performed.");
  lines.push("");
  lines.push("## Environment");
  lines.push("");
  lines.push(`- process node: \`${record.environment.execPath}\` ${record.environment.execVersion}`);
  lines.push(`- adapter present at start: ${adapterOk}`);
  lines.push(`- new pixel files: ${newPixels.length}; sha256 overlap with author good fixtures: ${overlap.length}`);
  lines.push("");
  lines.push("## Tasks");
  lines.push("");
  for (const task of record.tasks) {
    const mark = task.ok ? "PASS" : "FAIL";
    lines.push(`- **${task.id}**: ${mark} — status=${task.got.status} failedKits=${JSON.stringify(task.got.failedKits)} failedIds=${JSON.stringify(task.got.failedIds)}`);
  }
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  if (blockers.length === 0) {
    lines.push("None after following HANDOFF.md (project directory, existing adapter, sibling drafts present).");
  } else {
    for (const item of blockers) {
      lines.push(`- \`${item.id}\` (${item.during}): ${item.note}`);
    }
  }
  lines.push("");
  lines.push("## Manual edits");
  lines.push("");
  if (edits.length === 0) {
    lines.push("None.");
  } else {
    for (const item of edits) {
      lines.push(`- ${item.id}: ${item.note}`);
    }
  }
  lines.push("");
  lines.push("## Naive cwd");
  lines.push("");
  lines.push(`Short HANDOFF paths from workspace root: code=${record.naive.shortPathsFromWorkspaceRoot.code} status=${record.naive.shortPathsFromWorkspaceRoot.status || "(no json)"}`);
  if (record.naive.shortPathsFromWorkspaceRoot.stderr) {
    lines.push("");
    lines.push("```");
    lines.push(record.naive.shortPathsFromWorkspaceRoot.stderr);
    lines.push("```");
  }
  lines.push("");
  lines.push(`Workspace-root long paths: code=${record.naive.workspaceCwd.code} status=${record.naive.workspaceCwd.status || "(no json)"}`);
  if (record.naive.workspaceCwd.stderr) {
    lines.push("");
    lines.push("```");
    lines.push(record.naive.workspaceCwd.stderr);
    lines.push("```");
  }
  lines.push("");
  const mdPath = join(OBS, "drill.md");
  await writeFile(mdPath, `${lines.join("\n")}\n`);

  process.stdout.write(`${JSON.stringify({ jsonPath, mdPath, ok: aOk && bOk && bFixOk && overlap.length === 0 }, null, 2)}\n`);
  if (!(aOk && bOk && bFixOk && overlap.length === 0)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
