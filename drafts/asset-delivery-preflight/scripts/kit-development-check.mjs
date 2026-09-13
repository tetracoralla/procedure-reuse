#!/usr/bin/env node
/**
 * Development-regression lane for openadam-dev check.
 * Syntax + combinator tests + MCP carrier tests. Requires File Vitals adapter.
 */
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { constants as fsConstants } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT = resolve(HERE, "..");

const syntaxFiles = [
  "preflight.mjs",
  "preflight.test.mjs",
  "procedure/adapter.mjs",
  "procedure/check.mjs",
  "src/mcp-server.mjs",
  "src/mcp-server.test.mjs",
  "scripts/package-component.mjs",
  "scripts/kit-development-check.mjs",
];

function run(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: DRAFT,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

const adapter = join(DRAFT, "bin", "capability-adapter");
try {
  await access(adapter, fsConstants.X_OK);
} catch {
  process.stderr.write("File Vitals JSONL adapter missing. Build it first:\n");
  process.stderr.write("  drafts/asset-delivery-preflight/scripts/build-file-vitals.sh\n");
  process.exit(2);
}

const mcpSource = await readFile(join(DRAFT, "src", "mcp-server.mjs"), "utf8");
if (mcpSource.includes("CORE_NOT_IMPLEMENTED")) {
  process.stderr.write("MCP carrier must call the real preflight combinator.\n");
  process.exit(1);
}

for (const file of syntaxFiles) {
  run(["--check", join(DRAFT, file)]);
}

run(["--test", "preflight.test.mjs", "src/mcp-server.test.mjs"], {
  env: {
    ...process.env,
    OPENADAM_CAPABILITY_WORKSPACE_ROOT: DRAFT,
  },
});

process.stdout.write("PASS development-regression syntax+preflight+mcp\n");
