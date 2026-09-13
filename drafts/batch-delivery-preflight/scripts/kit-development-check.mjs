#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { constants as fsConstants } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");

function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

const preflight = await readFile(join(PROJECT, "src/preflight.mjs"), "utf8");
const skill = await readFile(
  join(PROJECT, "plugins/batch-delivery-preflight/skills/batch-delivery-preflight/SKILL.md"),
  "utf8",
);
const legal = await readFile(join(PROJECT, "LICENSE"), "utf8");
const project = JSON.parse(await readFile(join(PROJECT, "agent-tool.json"), "utf8"));

if (
  preflight.includes("CORE_NOT_IMPLEMENTED")
  || !preflight.includes("loadLower")
  || skill.includes("generated Skill remains a scaffold")
  || legal.includes("SCAFFOLD_LEGAL_REVIEW_REQUIRED")
  || project.package.probes.some((probe) => probe.id.startsWith("scaffold-"))
) {
  process.stderr.write(
    "INCOMPLETE: batch combinator must dispatch to lower runPreflight, with Skill/legal/probes authored.\n",
  );
  process.exit(1);
}

const syntaxFiles = [
  "src/preflight.mjs",
  "src/preflight.test.mjs",
  "src/spec.mjs",
  "src/lower.mjs",
  "src/cli.mjs",
  "src/mcp-server.mjs",
  "src/mcp-server.test.mjs",
  "procedure/adapter.mjs",
  "procedure/check.mjs",
  "scripts/package-component.mjs",
];

const adapter = join(PROJECT, "bin", "capability-adapter");
try {
  await access(adapter, fsConstants.X_OK);
} catch {
  process.stderr.write("File Vitals JSONL adapter missing. Build it first:\n");
  process.stderr.write("  scripts/build-file-vitals.sh\n");
  process.exit(2);
}

for (const file of syntaxFiles) {
  run(["--check", join(PROJECT, file)]);
}

run(["--test", "src/preflight.test.mjs", "src/mcp-server.test.mjs"], {
  env: {
    ...process.env,
    OPENADAM_CAPABILITY_WORKSPACE_ROOT: PROJECT,
  },
});

process.stdout.write("PASS development-regression syntax+preflight+mcp\n");
