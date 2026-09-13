#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ComposeScaffoldError, publicError } from "./errors.mjs";
import { initProject, SUPPORTED_TEMPLATES } from "./init.mjs";

const USAGE = `Usage:
  node drafts/devkit-compose-scaffold/src/cli.mjs init compose-procedure-preflight \\
    --destination PATH --id ID --package-name NAME --plugin NAME --operation NAME \\
    --name TEXT --summary TEXT --author TEXT [--procedure-id ID] [--license SPDX] \\
    [--dry-run] [--json]

This is the workspace compose/Procedure scaffold (Developer Kit currently only
ships node-mcp-provider). It does not push, import Host, or edit public catalogs.

Mechanical output: project skeleton, IO locations, file.inspect injection,
carriers, check/pack entry points, sample empty fixture, thin Skill.
Author/Agent output: spec schema, comparison rules, fixtures, failure handling.
`;

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { command: "help", json: argv.includes("--json") };
  }
  if (argv[0] !== "init") {
    throw new ComposeScaffoldError("CLI_USAGE", "Only the init command is supported.");
  }
  const options = {
    command: "init",
    template: argv[1],
    json: false,
    dryRun: false,
    license: "UNLICENSED",
  };
  if (options.template === undefined || options.template.startsWith("--")) {
    throw new ComposeScaffoldError(
      "CLI_USAGE",
      `init requires a template name. Supported: ${[...SUPPORTED_TEMPLATES].join(", ")}`,
    );
  }
  const valueOptions = new Map([
    ["--destination", "destination"],
    ["--id", "id"],
    ["--package-name", "packageName"],
    ["--plugin", "plugin"],
    ["--operation", "operation"],
    ["--name", "name"],
    ["--summary", "summary"],
    ["--author", "author"],
    ["--license", "license"],
    ["--procedure-id", "procedureId"],
  ]);
  const seen = new Set();
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const mapped = valueOptions.get(arg);
    if (mapped === undefined) {
      throw new ComposeScaffoldError("CLI_USAGE", `Unknown argument: ${arg}`);
    }
    if (seen.has(arg)) {
      throw new ComposeScaffoldError("CLI_USAGE", `Duplicate argument: ${arg}`);
    }
    seen.add(arg);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ComposeScaffoldError("CLI_USAGE", `${arg} requires a value`);
    }
    options[mapped] = value;
    index += 1;
  }
  for (const key of ["destination", "id", "packageName", "plugin", "operation", "name", "summary", "author"]) {
    if (options[key] === undefined) {
      const flag = key.replace(/[A-Z]/gu, (value) => `-${value.toLowerCase()}`);
      throw new ComposeScaffoldError("CLI_USAGE", `init requires --${flag}`);
    }
  }
  return options;
}

function human(result) {
  if (result.help !== undefined) return result.help;
  const files = Array.isArray(result.files) ? result.files.length : 0;
  return [
    `${result.status} ${result.template} → ${result.destination} (${files} files, mutation=${result.mutation})`,
    `procedure ${result.project?.procedureId}@${result.project?.version}`,
    result.nextAction,
  ].filter(Boolean).join("\n");
}

async function main(argv) {
  try {
    const options = parseArgs(argv);
    if (options.command === "help") {
      const result = { help: USAGE };
      process.stdout.write(options.json ? `${JSON.stringify({ help: USAGE }, null, 2)}\n` : USAGE);
      return 0;
    }
    const result = await initProject(options);
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${human(result)}\n`);
    return 0;
  } catch (error) {
    const body = publicError(error);
    process.stderr.write(`${body.code}: ${body.message}\n`);
    return 2;
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
