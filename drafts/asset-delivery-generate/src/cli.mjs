#!/usr/bin/env node
/**
 * One-shot: generate icon-pack PNG slots from one source, then preflight.
 *
 * Observation for preflight: org.openadam.file.inspect@0.1.0.
 * Generation is ordinary PNG code, not raster.prepare / brand-asset.prepare.
 */
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLower, resolveAdapter } from "./lower.mjs";
import { runGenerateThenPreflight } from "./pipeline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(HERE);

function usage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(`Usage: node src/cli.mjs --source <master.png> --spec <spec.json> --out <new-dir> [--overwrite] [--generate-only] [--adapter <capability-adapter>] [--compact]

Generate PNG slots (cover-crop, no upscale) into --out, keep the source file, then run asset-delivery-preflight.

Exit codes: 0 generate+preflight pass; 1 domain fail (see report.stage: generate | preflight); 2 usage/spec/adapter error.

Not org.openadam.raster.prepare. Not org.openadam.brand-asset.prepare. Not asset-prep.
`);
}

function parseArgs(argv) {
  const out = {
    source: null,
    spec: null,
    out: null,
    adapter: null,
    overwrite: false,
    generateOnly: false,
    pretty: true,
  };
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
      case "--source":
        out.source = next();
        break;
      case "--spec":
        out.spec = next();
        break;
      case "--out":
        out.out = next();
        break;
      case "--adapter":
        out.adapter = next();
        break;
      case "--overwrite":
        out.overwrite = true;
        break;
      case "--generate-only":
        out.generateOnly = true;
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
  if (!args.source || !args.spec || !args.out) {
    usage("--source, --spec, and --out are required");
    return 2;
  }
  try {
    const specPath = resolve(args.spec);
    const sourcePath = resolve(args.source);
    const outRoot = resolve(args.out);
    const lower = await loadLower();
    const spec = lower.loadSpec(await readFile(specPath, "utf8"), specPath);
    spec._path = specPath;
    const sourceInfo = await stat(sourcePath);
    if (!sourceInfo.isFile()) {
      throw new Error(`--source is not a file: ${sourcePath}`);
    }
    await realpath(dirname(sourcePath));
    let adapter = null;
    if (args.adapter) {
      adapter = await resolveAdapter(args.adapter, PROJECT_ROOT);
    }
    const report = await runGenerateThenPreflight({
      spec,
      source: sourcePath,
      out: outRoot,
      overwrite: args.overwrite,
      adapter,
      generateOnly: args.generateOnly,
    });
    process.stdout.write(`${JSON.stringify(report, null, args.pretty ? 2 : 0)}\n`);
    if (report.status === "pass") {
      return 0;
    }
    return 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
