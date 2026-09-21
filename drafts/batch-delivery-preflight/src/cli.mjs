#!/usr/bin/env node
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAdapter } from "./lower.mjs";
import { loadSpec } from "./spec.mjs";
import { runPreflight } from "./preflight.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(HERE);

function usage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(`Usage: node src/cli.mjs --spec <campaign.json> --root <campaign-dir> [--adapter <capability-adapter>] [--workspace-root <dir>] [--json | --compact]

Two-layer combinator: dispatches each kit to asset-delivery-preflight or channel-cover-preflight.
Observation: org.openadam.file.inspect@0.1.0 per kit root. Not raster.verify. Not Direct Runtime.
Default output is a short human result. Use --json for the complete report or --compact for one-line JSON.
`);
}

function parseArgs(argv) {
  const out = { spec: null, root: null, adapter: null, workspaceRoot: null, output: "human" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`${arg} requires a value`);
      }
      return argv[i];
    };
    switch (arg) {
      case "--spec":
        out.spec = next();
        break;
      case "--root":
        out.root = next();
        break;
      case "--adapter":
        out.adapter = next();
        break;
      case "--workspace-root":
        out.workspaceRoot = next();
        break;
      case "--compact":
        out.output = "compact-json";
        break;
      case "--json":
      case "--pretty":
        out.output = "pretty-json";
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}

function shown(value) {
  if (value === null || value === undefined) return "missing";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function formatHumanSummary(report, { limit = 8 } = {}) {
  const summary = report?.summary ?? {};
  if (report?.status === "pass") {
    return `PASS · ${summary.present ?? 0}/${summary.kits ?? 0} kits · ${summary.checks ?? 0} checks`;
  }
  const failed = (report?.checks ?? []).filter((check) => check?.passed === false);
  const lines = [
    `FAIL · ${(summary.failedKits ?? []).length}/${summary.kits ?? 0} kits · ${summary.failed ?? failed.length} failed checks`,
  ];
  for (const check of failed.slice(0, limit)) {
    const target = [check.kit, check.slot ?? check.path].filter(Boolean).join(" / ") || "delivery";
    lines.push(`- ${target}: ${check.id} · expected ${shown(check.expected)}, got ${shown(check.observed)}`);
  }
  if (failed.length > limit) lines.push(`- ${failed.length - limit} more · use --json for full details`);
  return lines.join("\n");
}

async function optionalAdapter(explicit) {
  try {
    return await resolveAdapter(explicit, PROJECT_ROOT);
  } catch {
    return null;
  }
}

export async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    usage(error.message);
    return 2;
  }
  if (args.help) {
    usage("");
    return 0;
  }
  if (!args.spec || !args.root) {
    usage("both --spec and --root are required");
    return 2;
  }
  try {
    const specPath = resolve(args.spec);
    const root = resolve(args.root);
    const workspaceRoot = resolve(args.workspaceRoot ?? root);
    const spec = loadSpec(await readFile(specPath, "utf8"), specPath);
    spec._path = specPath;
    spec._specDir = dirname(specPath);
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) {
      throw new Error(`--root is not a directory: ${root}`);
    }
    await realpath(workspaceRoot);
    const adapter = await optionalAdapter(args.adapter);
    const report = await runPreflight({ spec, root, adapter, workspaceRoot });
    if (args.output === "human") {
      process.stdout.write(`${formatHumanSummary(report)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(report, null, args.output === "pretty-json" ? 2 : 0)}\n`);
    }
    return report.status === "pass" ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
