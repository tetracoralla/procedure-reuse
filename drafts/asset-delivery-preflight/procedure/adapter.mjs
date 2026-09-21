#!/usr/bin/env node
/**
 * openadam.procedure-jsonl.v0.2 adapter for org.openadam.asset-delivery.preflight@0.1.0
 *
 * Reuses drafts/asset-delivery-preflight/preflight.mjs so comparison logic
 * cannot drift from the step-3 combinator. Observation remains
 * org.openadam.file.inspect@0.1.0 (File Vitals). This adapter does not
 * implement raster.verify.
 *
 * Success: { id, ok: true, result }
 * Failure: { id, ok: false, error: { code, message } }
 */

import { createInterface } from "node:readline";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseSpec, resolveAdapter, runPreflight } from "../preflight.mjs";

const PROCEDURE_ID = "org.openadam.asset-delivery.preflight";
const PROCEDURE_VERSION = "0.1.0";
const MAX_SLOTS = 32;
const INPUT_KEYS = new Set(["root", "workspaceRoot", "adapter", "spec", "specPath"]);

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
  return (
    relativePath === ".."
    || relativePath.startsWith(`..${sep}`)
    || isAbsolute(relativePath)
  );
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
  if (message.includes("File Vitals JSONL adapter not found") || message.includes("adapter exited")) {
    return new ProcedureError("PROVIDER_FAILED", message);
  }
  if (message.includes("not a directory")) {
    return new ProcedureError("ROOT_NOT_FOUND", message);
  }
  if (
    message.includes("unsupported field")
    || message.includes("forbidden field")
    || message.includes("spec must")
    || message.includes("slots[")
    || message.includes("spec.slots")
    || message.includes("missing id")
    || message.includes("missing path")
    || message.includes("missing format")
    || message.includes("missing width")
    || message.includes("missing height")
    || message.includes("missing alpha")
    || message.includes("missing required")
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
      `delivery root not found: ${input.root}`,
    );
    const rootInfo = await stat(root);
    if (!rootInfo.isDirectory()) {
      throw new ProcedureError("ROOT_NOT_FOUND", `delivery root is not a directory: ${input.root}`);
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
    } else {
      spec = parseSpec(input.spec, "input.spec");
      spec._path = null;
    }
    if (spec.slots.length > MAX_SLOTS) {
      throw new ProcedureError(
        "LIMIT_EXCEEDED",
        `spec.slots exceeds the Procedure bound of ${MAX_SLOTS}`,
      );
    }

    const adapter = await resolveAdapter(
      input.adapter === undefined ? undefined : resolve(implementationRoot, input.adapter),
    );
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
