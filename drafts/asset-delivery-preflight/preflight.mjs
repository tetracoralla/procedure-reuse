#!/usr/bin/env node
/**
 * Asset-delivery preflight combinator (draft).
 *
 * Reads a technical slot spec, calls File Vitals JSONL `inspect`
 * (org.openadam.file.inspect@0.1.0) for each required path, then compares
 * name / format / width / height / alpha plus missing / extra.
 *
 * This is ordinary code. It is not raster.verify, not a new Capability,
 * and not a workflow DSL.
 */

import { spawn } from "node:child_process";
import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ADAPTER = join(HERE, "bin", "capability-adapter");
const JSONL_BATCH_LIMIT = 16;
const SLOT_KEYS = new Set(["id", "path", "name", "format", "width", "height", "alpha", "required"]);
const SPEC_KEYS = new Set(["id", "version", "title", "description", "alphaPolicy", "slots"]);
const ALPHA_VALUES = new Set(["present", "absent", "any", "unknown"]);
const FORMAT_VALUES = new Set(["png", "jpeg", "gif", "webp"]);
const REJECTED_FIELDS = [
  "quality",
  "beauty",
  "brand",
  "aesthetic",
  "style",
  "look",
  "feel",
  "harmony",
  "pretty",
  "visual",
];

const FORMAT_ALIASES = {
  png: "png",
  "image/png": "png",
  jpeg: "jpeg",
  jpg: "jpeg",
  "image/jpeg": "jpeg",
  gif: "gif",
  "image/gif": "gif",
  webp: "webp",
  "image/webp": "webp",
};

function usage(message) {
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.stderr.write(`Usage: node preflight.mjs --spec <spec.json> --root <delivery-dir> [--adapter <capability-adapter>] [--workspace-root <dir>]

Environment:
  OPENADAM_CAPABILITY_WORKSPACE_ROOT  Set automatically to --workspace-root or the absolute --root
  FILE_VITALS_ADAPTER                 Optional path to the File Vitals JSONL adapter binary

This combinator calls org.openadam.file.inspect@0.1.0 (File Vitals). It does not implement raster.verify.
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

function rejectAesthetic(label, object) {
  for (const key of Object.keys(object)) {
    const lower = key.toLowerCase();
    if (REJECTED_FIELDS.includes(lower)) {
      throw new Error(`${label} contains forbidden field ${key} (technical preflight only)`);
    }
  }
}

function assertKeys(label, object, allowed) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unsupported field ${key}`);
    }
  }
}

export function parseSpec(spec, specPath) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("spec must be a JSON object");
  }
  rejectAesthetic(specPath, spec);
  assertKeys(specPath, spec, SPEC_KEYS);
  if (!Array.isArray(spec.slots) || spec.slots.length === 0) {
    throw new Error("spec.slots must be a non-empty array");
  }
  const seenIds = new Set();
  const seenPaths = new Set();
  spec.slots.forEach((slot, index) => {
    const label = `${specPath} slots[${index}]`;
    if (slot === null || typeof slot !== "object" || Array.isArray(slot)) {
      throw new Error(`${label} must be an object`);
    }
    rejectAesthetic(label, slot);
    assertKeys(label, slot, SLOT_KEYS);
    for (const required of ["id", "path", "format", "width", "height", "alpha", "required"]) {
      if (!(required in slot)) {
        throw new Error(`${label} missing ${required}`);
      }
    }
    if (typeof slot.id !== "string" || slot.id.length === 0) {
      throw new Error(`${label}.id must be a non-empty string`);
    }
    if (seenIds.has(slot.id)) {
      throw new Error(`${label}.id duplicates ${slot.id}`);
    }
    seenIds.add(slot.id);
    if (typeof slot.path !== "string" || slot.path.length === 0 || isAbsolute(slot.path) || slot.path.includes("..") || slot.path.includes("\\")) {
      throw new Error(`${label}.path must be a relative POSIX path without ..`);
    }
    if (seenPaths.has(slot.path)) {
      throw new Error(`${label}.path duplicates ${slot.path}`);
    }
    seenPaths.add(slot.path);
    slot.name = slot.name ?? basename(slot.path);
    if (typeof slot.name !== "string" || slot.name.length === 0) {
      throw new Error(`${label}.name must be a non-empty string`);
    }
    if (typeof slot.format !== "string" || !FORMAT_VALUES.has(slot.format)) {
      throw new Error(`${label}.format must be one of ${[...FORMAT_VALUES].join(", ")}`);
    }
    if (!Number.isInteger(slot.width) || slot.width < 1 || !Number.isInteger(slot.height) || slot.height < 1) {
      throw new Error(`${label} width/height must be positive integers`);
    }
    if (!ALPHA_VALUES.has(slot.alpha)) {
      throw new Error(`${label}.alpha must be present|absent|any|unknown`);
    }
    if (typeof slot.required !== "boolean") {
      throw new Error(`${label}.required must be a boolean`);
    }
  });
  return spec;
}

export function loadSpec(raw, specPath) {
  return parseSpec(JSON.parse(raw), specPath);
}

async function listRegularFiles(root) {
  const files = [];
  async function walk(dir, rel) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, childRel);
        continue;
      }
      if (entry.isFile()) {
        files.push(childRel.split(sep).join("/"));
      }
    }
  }
  await walk(root, "");
  return files;
}

function normalizeFormat(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const key = String(value).trim().toLowerCase();
  return FORMAT_ALIASES[key] ?? key;
}

function observedAlpha(image) {
  if (!image || image.has_alpha === undefined || image.has_alpha === null) {
    return "unknown";
  }
  return image.has_alpha ? "present" : "absent";
}

function alphaPassed(expected, observed) {
  if (expected === "any") {
    return true;
  }
  return expected === observed;
}

function checkRecord({ id, slot, path, expected, observed, passed, error }) {
  const record = { id, passed, expected, observed };
  if (slot) {
    record.slot = slot;
  }
  if (path) {
    record.path = path;
  }
  if (error) {
    record.error = error;
  }
  return record;
}

function inspectError(response) {
  if (!response) {
    return { code: "INSPECTION_FAILED", message: "No JSONL response for this path." };
  }
  if (response.ok === false && response.error) {
    return { code: response.error.code ?? "INSPECTION_FAILED", message: response.error.message ?? "inspect failed" };
  }
  return null;
}

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

/**
 * File Vitals inspect paths must name the delivery file relative to the
 * inspect grant. When workspaceRoot is an ancestor of root, that means a
 * prefix (delivery/icon-16.png), not the same relative name under the grant.
 */
export function inspectPathForGrant(workspaceRoot, deliveryRoot, slotPath) {
  const absolute = resolve(deliveryRoot, slotPath);
  if (isOutside(deliveryRoot, absolute)) {
    throw new Error(`slot path escapes delivery root: ${slotPath}`);
  }
  if (isOutside(workspaceRoot, absolute)) {
    throw new Error(`delivery file is outside the inspect grant: ${slotPath}`);
  }
  const rel = relative(workspaceRoot, absolute);
  return rel.split(sep).join("/");
}

function observationQualityChecks(slot, response) {
  const envelope = inspectError(response);
  const result = response?.ok ? response.result : null;
  const status = result?.status ?? null;
  const integrity = result?.integrity ?? null;
  const diagnostics = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
  const errorDiagnostics = diagnostics.filter((item) => item && item.severity === "error");
  const checks = [];

  if (envelope) {
    checks.push(
      checkRecord({
        id: "inspectStatus",
        slot: slot.id,
        path: slot.path,
        expected: "ok|partial",
        observed: envelope.code,
        passed: false,
        error: envelope,
      }),
    );
    return { checks, envelope, result, status, integrity, diagnostics };
  }

  const statusPass = status === "ok" || status === "partial";
  checks.push(
    checkRecord({
      id: "inspectStatus",
      slot: slot.id,
      path: slot.path,
      expected: "ok|partial",
      observed: status,
      passed: statusPass,
    }),
  );

  const readable = integrity?.readable;
  const parseable = integrity?.parseable;
  const integrityPass = readable !== false && parseable !== false;
  let observedIntegrity = "readable";
  if (readable === false) {
    observedIntegrity = "unreadable";
  } else if (parseable === false) {
    observedIntegrity = "unparseable";
  }
  checks.push(
    checkRecord({
      id: "inspectIntegrity",
      slot: slot.id,
      path: slot.path,
      expected: "readable",
      observed: observedIntegrity,
      passed: integrityPass,
    }),
  );

  checks.push(
    checkRecord({
      id: "inspectDiagnostic",
      slot: slot.id,
      path: slot.path,
      expected: "no-error-diagnostics",
      observed: errorDiagnostics.length === 0 ? "none" : errorDiagnostics.map((item) => item.code).join(","),
      passed: errorDiagnostics.length === 0,
    }),
  );

  return { checks, envelope: null, result, status, integrity, diagnostics };
}

async function inspectSession(adapter, workspaceRoot, paths) {
  if (paths.length === 0) {
    return new Map();
  }
  if (paths.length > JSONL_BATCH_LIMIT) {
    throw new Error(`internal: inspect session exceeds JSONL admission cap ${JSONL_BATCH_LIMIT}`);
  }
  const requests = paths.map((path, index) => ({
    id: `s${index}`,
    operationId: "inspect",
    input: { path, mode: "standard", hash: "none" },
  }));
  const stdin = requests.map((request) => `${JSON.stringify(request)}\n`).join("");
  const { stdout, stderr, code } = await new Promise((resolvePromise, reject) => {
    const child = spawn(adapter, [], {
      env: {
        ...process.env,
        OPENADAM_CAPABILITY_WORKSPACE_ROOT: workspaceRoot,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const outChunks = [];
    const errChunks = [];
    child.stdout.on("data", (chunk) => outChunks.push(chunk));
    child.stderr.on("data", (chunk) => errChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({
        stdout: Buffer.concat(outChunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
        code: exitCode,
      });
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
  if (code !== 0 && !stdout.trim()) {
    throw new Error(`File Vitals JSONL adapter exited ${code}: ${stderr.trim() || "no stderr"}`);
  }
  const byId = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const response = JSON.parse(line);
    if (response.id) {
      byId.set(response.id, response);
    }
  }
  const out = new Map();
  requests.forEach((request, index) => {
    out.set(paths[index], byId.get(request.id) ?? null);
  });
  return out;
}

async function inspectAll(adapter, workspaceRoot, paths) {
  const unique = [...new Set(paths)];
  const out = new Map();
  for (let offset = 0; offset < unique.length; offset += JSONL_BATCH_LIMIT) {
    const chunk = unique.slice(offset, offset + JSONL_BATCH_LIMIT);
    const part = await inspectSession(adapter, workspaceRoot, chunk);
    for (const [path, response] of part) {
      out.set(path, response);
    }
  }
  return out;
}

function compareSlot(slot, response) {
  const checks = [];
  const error = inspectError(response);
  const result = response?.ok ? response.result : null;
  const fileName = result?.file?.name ?? null;
  const identityFormat = normalizeFormat(result?.identity?.format) ?? normalizeFormat(result?.identity?.media_type);
  const width = result?.image?.width ?? null;
  const height = result?.image?.height ?? null;
  const alpha = result ? observedAlpha(result.image) : "unknown";

  checks.push(
    checkRecord({
      id: "name",
      slot: slot.id,
      path: slot.path,
      expected: slot.name,
      observed: fileName,
      passed: !error && fileName === slot.name,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "format",
      slot: slot.id,
      path: slot.path,
      expected: slot.format,
      observed: identityFormat,
      passed: !error && identityFormat === slot.format,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "width",
      slot: slot.id,
      path: slot.path,
      expected: slot.width,
      observed: width,
      passed: !error && width === slot.width,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "height",
      slot: slot.id,
      path: slot.path,
      expected: slot.height,
      observed: height,
      passed: !error && height === slot.height,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "alpha",
      slot: slot.id,
      path: slot.path,
      expected: slot.alpha,
      observed: alpha,
      passed: !error && alphaPassed(slot.alpha, alpha),
      error,
    }),
  );
  return { checks, observation: result, error };
}

export async function runPreflight({ spec, root, adapter, workspaceRoot }) {
  const deliveryRoot = resolve(root);
  const inspectGrant = resolve(workspaceRoot ?? deliveryRoot);
  if (isOutside(inspectGrant, deliveryRoot)) {
    throw new Error(`delivery root is outside the inspect grant: ${deliveryRoot}`);
  }
  const diskFiles = await listRegularFiles(deliveryRoot);
  const diskSet = new Set(diskFiles);
  const declaredPaths = new Set(spec.slots.map((slot) => slot.path));
  const inspectBySlot = new Map();
  for (const slot of spec.slots) {
    if (diskSet.has(slot.path)) {
      inspectBySlot.set(slot.path, inspectPathForGrant(inspectGrant, deliveryRoot, slot.path));
    }
  }
  const inspectPaths = [...new Set(inspectBySlot.values())];
  const responses = await inspectAll(adapter, inspectGrant, inspectPaths);

  const checks = [];
  const slots = [];
  for (const slot of spec.slots) {
    const present = diskSet.has(slot.path);
    if (!present) {
      if (slot.required) {
        checks.push(
          checkRecord({
            id: "missing",
            slot: slot.id,
            path: slot.path,
            expected: slot.path,
            observed: null,
            passed: false,
          }),
        );
        slots.push({ id: slot.id, path: slot.path, present: false, required: true });
      } else {
        slots.push({ id: slot.id, path: slot.path, present: false, required: false });
      }
      continue;
    }
    const inspectPath = inspectBySlot.get(slot.path);
    const response = responses.get(inspectPath);
    const quality = observationQualityChecks(slot, response);
    checks.push(...quality.checks);
    const compared = compareSlot(slot, response);
    checks.push(...compared.checks);
    slots.push({
      id: slot.id,
      path: slot.path,
      present: true,
      required: slot.required,
      inspectError: compared.error,
      inspectStatus: quality.status ?? null,
      integrity: quality.integrity ?? null,
      diagnostics: quality.diagnostics ?? [],
      file: compared.observation?.file ?? null,
      identity: compared.observation?.identity
        ? {
            format: compared.observation.identity.format ?? null,
            media_type: compared.observation.identity.media_type ?? null,
            extension_match: compared.observation.identity.extension_match ?? null,
          }
        : null,
      image: compared.observation?.image ?? null,
    });
  }

  const extras = diskFiles.filter((path) => !declaredPaths.has(path));
  for (const path of extras) {
    checks.push(
      checkRecord({
        id: "extra",
        path,
        expected: null,
        observed: path,
        passed: false,
      }),
    );
  }

  const failed = checks.filter((check) => !check.passed);
  return {
    status: failed.length === 0 ? "pass" : "fail",
    spec: { id: spec.id ?? null, version: spec.version ?? null, path: spec._path ?? null },
    root,
    workspaceRoot,
    observer: {
      capability: "org.openadam.file.inspect@0.1.0",
      operation: "inspect",
      provider: "io.github.tetracoralla.file-vitals",
      transport: "openadam.capability-jsonl.v0.1",
      adapter,
      note: "Observation only. Comparison is ordinary combinator code, not raster.verify.",
    },
    slots,
    extras,
    checks,
    summary: {
      slots: spec.slots.length,
      files: diskFiles.length,
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      failedIds: [...new Set(failed.map((check) => check.id))],
    },
  };
}

export async function resolveAdapter(explicit) {
  const candidates = [explicit, process.env.FILE_VITALS_ADAPTER, DEFAULT_ADAPTER].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    try {
      await access(resolved, fsConstants.X_OK);
      const info = await stat(resolved);
      if (info.isFile()) {
        return resolved;
      }
    } catch {
      // try next
    }
  }
  throw new Error(
    `File Vitals JSONL adapter not found. Build it with drafts/asset-delivery-preflight/scripts/build-file-vitals.sh (needs Go ${"1.26.6+"}). Looked at: ${candidates.join(", ") || DEFAULT_ADAPTER}`,
  );
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
  const specPath = resolve(args.spec);
  const root = resolve(args.root);
  const workspaceRoot = resolve(args.workspaceRoot ?? root);
  let adapter;
  try {
    adapter = await resolveAdapter(args.adapter);
    const spec = loadSpec(await readFile(specPath, "utf8"), specPath);
    spec._path = specPath;
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) {
      throw new Error(`--root is not a directory: ${root}`);
    }
    await realpath(workspaceRoot);
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
