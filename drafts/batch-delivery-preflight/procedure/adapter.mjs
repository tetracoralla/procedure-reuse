#!/usr/bin/env node
/**
 * openadam.procedure-jsonl.v0.2 adapter for org.openadam.batch-delivery.preflight@0.1.0
 *
 * Dispatches each kit to an existing combinator via src/preflight.mjs.
 * Observation remains file.inspect per kit. Not raster.verify. Not Direct Runtime.
 */
import { createInterface } from "node:readline";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAdapter } from "../src/lower.mjs";
import { parseSpec } from "../src/spec.mjs";
import { runPreflight } from "../src/preflight.mjs";

const PROCEDURE_ID = "org.openadam.batch-delivery.preflight";
const PROCEDURE_VERSION = "0.1.0";
const MAX_KITS = 8;
const INPUT_KEYS = new Set(["root", "workspaceRoot", "adapter", "spec", "specPath"]);
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(HERE);

class ProcedureError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function respond(id, body) {
  process.stdout.write(`${JSON.stringify({ id, ...body })}\n`);
}

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

function assertRelativeGrant(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProcedureError("INVALID_INPUT", `${label} must be a non-empty string`);
  }
  if (isAbsolute(value) || value.includes("..") || value.includes("\\") || value.includes("\0")) {
    throw new ProcedureError(
      "PATH_FORBIDDEN",
      `${label} must be a relative POSIX path inside the implementation root`,
    );
  }
}

async function resolveInside(root, candidate, missingCode, missingMessage) {
  const resolved = resolve(root, candidate);
  if (isOutside(root, resolved)) {
    throw new ProcedureError("PATH_FORBIDDEN", missingMessage);
  }
  try {
    const canonical = await realpath(resolved);
    if (isOutside(root, canonical)) {
      throw new ProcedureError("PATH_FORBIDDEN", missingMessage);
    }
    return canonical;
  } catch (error) {
    if (error instanceof ProcedureError) {
      throw error;
    }
    if (error && error.code === "ENOENT") {
      throw new ProcedureError(missingCode, missingMessage);
    }
    throw new ProcedureError("PROVIDER_FAILED", error instanceof Error ? error.message : String(error));
  }
}

function mapThrown(error) {
  if (error instanceof ProcedureError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("File Vitals JSONL adapter") || message.includes("adapter exited") || message.includes("combinator not found")) {
    return new ProcedureError("PROVIDER_FAILED", message);
  }
  if (message.includes("not a directory")) {
    return new ProcedureError("ROOT_NOT_FOUND", message);
  }
  if (
    message.includes("unsupported field")
    || message.includes("forbidden field")
    || message.includes("spec must")
    || message.includes("kits[")
    || message.includes("family must")
  ) {
    return new ProcedureError("INVALID_INPUT", message);
  }
  return new ProcedureError("PROVIDER_FAILED", message);
}

async function handleRequest(request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    return { id: "unknown", ok: false, error: { code: "INVALID_INPUT", message: "request must be an object" } };
  }
  const id = typeof request.id === "string" && request.id.length > 0 ? request.id : "unknown";
  try {
    if (request.procedureId !== PROCEDURE_ID || request.procedureVersion !== PROCEDURE_VERSION) {
      throw new ProcedureError(
        "INVALID_INPUT",
        `this adapter implements ${PROCEDURE_ID}@${PROCEDURE_VERSION}`,
      );
    }
    const input = request.input;
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new ProcedureError("INVALID_INPUT", "input must be an object");
    }
    for (const key of Object.keys(input)) {
      if (!INPUT_KEYS.has(key)) {
        throw new ProcedureError("INVALID_INPUT", `input has unsupported field ${key}`);
      }
    }
    const hasSpec = Object.hasOwn(input, "spec");
    const hasSpecPath = Object.hasOwn(input, "specPath");
    if (hasSpec === hasSpecPath) {
      throw new ProcedureError("INVALID_INPUT", "input must include exactly one of spec or specPath");
    }
    assertRelativeGrant(input.root, "root");
    if (input.workspaceRoot !== undefined) {
      assertRelativeGrant(input.workspaceRoot, "workspaceRoot");
    }
    if (input.specPath !== undefined) {
      assertRelativeGrant(input.specPath, "specPath");
    }
    if (input.adapter !== undefined) {
      assertRelativeGrant(input.adapter, "adapter");
    }

    const implementationRoot = await realpath(
      resolve(process.env.OPENADAM_IMPLEMENTATION_ROOT ?? process.cwd()),
    );
    const root = await resolveInside(
      implementationRoot,
      input.root,
      "ROOT_NOT_FOUND",
      `campaign root not found: ${input.root}`,
    );
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) {
      throw new ProcedureError("ROOT_NOT_FOUND", `campaign root is not a directory: ${input.root}`);
    }
    const workspaceRoot = input.workspaceRoot === undefined
      ? root
      : await resolveInside(
        implementationRoot,
        input.workspaceRoot,
        "PATH_FORBIDDEN",
        `workspaceRoot not found: ${input.workspaceRoot}`,
      );

    let spec;
    if (hasSpecPath) {
      const specFile = await resolveInside(
        implementationRoot,
        input.specPath,
        "INVALID_INPUT",
        `specPath not found: ${input.specPath}`,
      );
      spec = parseSpec(JSON.parse(await readFile(specFile, "utf8")), specFile);
      spec._path = specFile;
      spec._specDir = dirname(specFile);
    } else {
      spec = parseSpec(input.spec, "input.spec");
      spec._path = null;
      spec._specDir = implementationRoot;
    }
    if (spec.kits.length > MAX_KITS) {
      throw new ProcedureError(
        "LIMIT_EXCEEDED",
        `spec.kits exceeds the Procedure bound of ${MAX_KITS}`,
      );
    }

    let adapter = null;
    try {
      adapter = await resolveAdapter(
        input.adapter === undefined ? undefined : resolve(implementationRoot, input.adapter),
        PROJECT_ROOT,
      );
    } catch {
      adapter = null;
    }
    const result = await runPreflight({ spec, root, adapter, workspaceRoot });
    return { id, ok: true, result };
  } catch (error) {
    const mapped = mapThrown(error);
    return { id, ok: false, error: { code: mapped.code, message: mapped.message } };
  }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) {
    continue;
  }
  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    respond("unknown", {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "request is not JSON",
      },
    });
    continue;
  }
  const response = await handleRequest(request);
  respond(response.id, response.ok
    ? { ok: true, result: response.result }
    : { ok: false, error: response.error });
}
