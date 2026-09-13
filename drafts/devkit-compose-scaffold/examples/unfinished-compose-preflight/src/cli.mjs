#!/usr/bin/env node
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAdapter } from "../lib/observe-file-inspect.mjs";
import { loadSpec } from "./spec.mjs";
import { runPreflight } from "./preflight.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(HERE);

function usage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(`Usage: node src/cli.mjs --spec <spec.json> --root <delivery-dir> [--adapter <capability-adapter>] [--workspace-root <dir>] [--compact]

Observation: org.openadam.file.inspect@0.1.0 (File Vitals). Comparison is src/compare.mjs, not raster.verify.
`);
}

function parseArgs(argv) {
  const out = { spec: null, root: null, adapter: null, workspaceRoot: null, pretty: true };
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
        out.pretty = false;
        break;
      case "--pretty":
        out.pretty = true;
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

async function optionalAdapter(explicit) {
  try {
    return await resolveAdapter(explicit, { projectRoot: PROJECT_ROOT });
  } catch {
    return null;
  }
}

async function main(argv) {
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
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) {
      throw new Error(`--root is not a directory: ${root}`);
    }
    await realpath(workspaceRoot);
    const adapter = await optionalAdapter(args.adapter);
    const report = await runPreflight({ spec, root, adapter, workspaceRoot });
    process.stdout.write(`${JSON.stringify(report, null, args.pretty ? 2 : 0)}\n`);
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
