#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAFT = resolve(HERE, "..");
const FINSPECT = join(DRAFT, "bin", "finspect");
const ADAPTER = join(DRAFT, "bin", "capability-adapter");
const OUT = join(DRAFT, "observations");

function run(command, args, { env = process.env, cwd, stdin } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, cwd, stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolvePromise({
        code,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function pickInspect(full) {
  return {
    status: full.status,
    file: {
      name: full.file?.name ?? null,
      size_bytes: full.file?.size_bytes ?? null,
      extension: full.file?.extension ?? null,
    },
    identity: {
      format: full.identity?.format ?? null,
      media_type: full.identity?.media_type ?? null,
      confidence: full.identity?.confidence ?? null,
      extension_match: full.identity?.extension_match ?? null,
      conflicts: full.identity?.conflicts ?? [],
    },
    image: full.image
      ? {
          width: full.image.width ?? null,
          height: full.image.height ?? null,
          color_model: full.image.color_model ?? null,
          ...(Object.prototype.hasOwnProperty.call(full.image, "has_alpha")
            ? { has_alpha: full.image.has_alpha }
            : { has_alpha_omitted: true }),
        }
      : null,
  };
}

async function finspectJson(path) {
  const result = await run(FINSPECT, [path, "--json"]);
  if (result.code !== 0) {
    throw new Error(`finspect ${path} exited ${result.code}: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const samples = {
    "good-icon-16": join(DRAFT, "fixtures/good/icon-16.png"),
    "good-wordmark-opaque": join(DRAFT, "fixtures/good/wordmark.png"),
    "bad-wrong-size-icon-64": join(DRAFT, "fixtures/bad/wrong-size/icon-64.png"),
    "bad-wrong-format-wordmark": join(DRAFT, "fixtures/bad/wrong-format/wordmark.png"),
    "sample-vp8l-unknown-alpha": join(DRAFT, "observations/samples/vp8l-unknown-alpha.webp"),
    "sample-ico-no-identity": join(DRAFT, "observations/samples/icon.ico"),
  };

  const summary = {};
  for (const [label, path] of Object.entries(samples)) {
    const full = await finspectJson(path);
    await writeFile(join(OUT, `finspect-${label}.json`), `${JSON.stringify(full, null, 2)}\n`);
    summary[label] = pickInspect(full);
  }
  await writeFile(join(OUT, "finspect-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  const goodDir = join(DRAFT, "fixtures/good");
  const batchArgs = [
    "batch",
    "icon-16.png",
    "icon-32.png",
    "icon-64.png",
    "icon-128.png",
    "wordmark.png",
    "og-cover.png",
    "--json",
  ];
  const batch = await run(FINSPECT, batchArgs, { cwd: goodDir });
  if (batch.code !== 0) {
    throw new Error(`finspect batch exited ${batch.code}: ${batch.stderr || batch.stdout}`);
  }
  await writeFile(join(OUT, "finspect-batch-good.json"), batch.stdout.endsWith("\n") ? batch.stdout : `${batch.stdout}\n`);

  const request = {
    id: "obs-icon-16",
    operationId: "inspect",
    input: { path: "icon-16.png", mode: "standard", hash: "none" },
  };
  const jsonl = await run(ADAPTER, [], {
    env: { ...process.env, OPENADAM_CAPABILITY_WORKSPACE_ROOT: goodDir },
    stdin: `${JSON.stringify(request)}\n`,
  });
  if (jsonl.code !== 0) {
    throw new Error(`capability-adapter exited ${jsonl.code}: ${jsonl.stderr || jsonl.stdout}`);
  }
  await writeFile(join(OUT, "jsonl-inspect-icon-16.jsonl"), jsonl.stdout.endsWith("\n") ? jsonl.stdout : `${jsonl.stdout}\n`);
  const jsonlObj = JSON.parse(jsonl.stdout.trim().split("\n")[0]);
  await writeFile(join(OUT, "jsonl-inspect-icon-16.pretty.json"), `${JSON.stringify(jsonlObj, null, 2)}\n`);

  console.log(`wrote observations under ${OUT}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
