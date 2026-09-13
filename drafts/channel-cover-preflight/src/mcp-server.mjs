#!/usr/bin/env node
/**
 * Thin MCP stdio carrier around src/preflight.mjs.
 * Tool channel_cover_preflight calls runPreflight. Observation remains file.inspect.
 */
import { createInterface } from "node:readline";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAdapter } from "../lib/observe-file-inspect.mjs";
import { parseSpec } from "./spec.mjs";
import { runPreflight } from "./preflight.mjs";

export const TOOL_NAME = "channel_cover_preflight";
export const SERVER_NAME = "channel-cover-preflight";
export const SERVER_VERSION = "0.1.0";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(HERE);
const INPUT_KEYS = new Set(["root", "spec", "specPath"]);
const MAX_SLOTS = 32;
const WORKSPACE_ENV = "OPENADAM_CAPABILITY_WORKSPACE_ROOT";

export const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["root"],
  properties: {
    root: {
      type: "string",
      minLength: 1,
      maxLength: 4096,
      description: "Delivery directory relative to the workspace grant.",
    },
    specPath: {
      type: "string",
      minLength: 1,
      maxLength: 4096,
      description: "Spec JSON path relative to the workspace grant.",
    },
    spec: {
      type: "object",
      additionalProperties: true,
      required: ["slots"],
      description: "Inline slot spec. Provide exactly one of spec or specPath. Domain fields are validated by src/spec.mjs.",
      properties: {
        id: { type: "string" },
        version: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        slots: { type: "array", minItems: 1, maxItems: 32 },
      },
    },
  },
};

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    summary: { type: "object" },
    observer: { type: "object" },
    checks: { type: "array" },
    slots: { type: "array" },
    extras: { type: "array" },
    error: { type: "object" },
  },
};

export const TOOL_DEFINITION = {
  name: TOOL_NAME,
  title: "Channel cover preflight",
  description: "Read-only preflight for channel-cover slots using file.inspect observations and combinator comparison. Does not implement raster.verify.",
  inputSchema: INPUT_SCHEMA,
  outputSchema: OUTPUT_SCHEMA,
  annotations: {
    title: "Channel cover preflight",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

class ProtocolError extends Error {
  constructor(message, code = -32602) {
    super(message);
    this.protocolCode = code;
  }
}

class ToolError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

function assertRelativeGrant(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ProtocolError(`${label} must be a non-empty string`);
  }
  if (isAbsolute(value) || value.includes("..") || value.includes("\\") || value.includes("\0")) {
    throw new ToolError("PATH_FORBIDDEN", `${label} must be a relative POSIX path inside the workspace grant`);
  }
}

async function resolveInside(root, candidate, missingCode, missingMessage) {
  const resolved = resolve(root, candidate);
  if (isOutside(root, resolved)) {
    throw new ToolError("PATH_FORBIDDEN", missingMessage);
  }
  try {
    const canonical = await realpath(resolved);
    if (isOutside(root, canonical)) {
      throw new ToolError("PATH_FORBIDDEN", missingMessage);
    }
    return canonical;
  } catch (error) {
    if (error instanceof ToolError || error instanceof ProtocolError) {
      throw error;
    }
    if (error && error.code === "ENOENT") {
      throw new ToolError(missingCode, missingMessage);
    }
    throw new ToolError("PROVIDER_FAILED", error instanceof Error ? error.message : String(error));
  }
}

function mapThrown(error) {
  if (error instanceof ProtocolError || error instanceof ToolError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("File Vitals JSONL adapter") || message.includes("adapter exited")) {
    return new ToolError("PROVIDER_FAILED", message);
  }
  if (message.includes("not a directory")) {
    return new ToolError("ROOT_NOT_FOUND", message);
  }
  if (
    message.includes("unsupported field")
    || message.includes("forbidden field")
    || message.includes("spec must")
    || message.includes("slots[")
    || message.includes("spec.slots")
    || message.includes("missing id")
    || message.includes("missing path")
    || message.includes("missing required")
  ) {
    return new ToolError("INVALID_INPUT", message);
  }
  return new ToolError("PROVIDER_FAILED", message);
}

function toolResult(structured, isError = false) {
  const text = JSON.stringify(structured);
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
    isError,
  };
}

export async function callTool(params) {
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    throw new ProtocolError("tools/call params must be an object");
  }
  if (params.name !== TOOL_NAME) {
    throw new ProtocolError(`unknown tool: ${params.name ?? "missing"}`);
  }
  const input = params.arguments;
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ProtocolError("arguments must be an object");
  }
  for (const key of Object.keys(input)) {
    if (!INPUT_KEYS.has(key)) {
      throw new ProtocolError(`arguments has unsupported field ${key}`);
    }
  }
  if (typeof input.root !== "string" || input.root.length === 0) {
    throw new ProtocolError("arguments.root is required");
  }
  const hasSpec = Object.hasOwn(input, "spec");
  const hasSpecPath = Object.hasOwn(input, "specPath");
  if (hasSpec === hasSpecPath) {
    throw new ProtocolError("arguments must include exactly one of spec or specPath");
  }

  const grantValue = process.env[WORKSPACE_ENV];
  if (typeof grantValue !== "string" || grantValue.length === 0) {
    throw new ToolError(
      "WORKSPACE_GRANT_REQUIRED",
      `${WORKSPACE_ENV} must name the Agent workspace grant before this tool can run`,
    );
  }

  assertRelativeGrant(input.root, "root");
  if (hasSpecPath) {
    assertRelativeGrant(input.specPath, "specPath");
  }

  const grant = await realpath(grantValue);
  const deliveryRoot = await resolveInside(
    grant,
    input.root,
    "ROOT_NOT_FOUND",
    `delivery root not found: ${input.root}`,
  );
  const rootInfo = await stat(deliveryRoot);
  if (!rootInfo.isDirectory()) {
    throw new ToolError("ROOT_NOT_FOUND", `delivery root is not a directory: ${input.root}`);
  }

  let spec;
  if (hasSpecPath) {
    const specFile = await resolveInside(
      grant,
      input.specPath,
      "INVALID_INPUT",
      `specPath not found: ${input.specPath}`,
    );
    spec = parseSpec(JSON.parse(await readFile(specFile, "utf8")), specFile);
    spec._path = specFile;
  } else {
    spec = parseSpec(input.spec, "arguments.spec");
    spec._path = null;
  }
  if (spec.slots.length > MAX_SLOTS) {
    throw new ToolError("LIMIT_EXCEEDED", `spec.slots exceeds the bound of ${MAX_SLOTS}`);
  }

  let adapter = null;
  try {
    adapter = await resolveAdapter(undefined, { projectRoot: PROJECT_ROOT });
  } catch {
    adapter = null;
  }
  return toolResult(await runPreflight({
    spec,
    root: deliveryRoot,
    adapter,
    workspaceRoot: deliveryRoot,
  }));
}

export function initializeResult(params) {
  const requested = params?.protocolVersion;
  return {
    protocolVersion: typeof requested === "string" && requested.length > 0 ? requested : "2025-03-26",
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    instructions: "Call channel_cover_preflight with a workspace grant, a relative delivery root, and exactly one of spec or specPath. Observation is file.inspect; comparison is combinator code, not raster.verify.",
  };
}

export async function handleMessage(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return { error: { code: -32600, message: "Invalid request" } };
  }
  const method = message.method;
  if (typeof method !== "string") {
    return { error: { code: -32600, message: "Invalid request" } };
  }
  try {
    if (method === "initialize") {
      return { result: initializeResult(message.params) };
    }
    if (method === "ping") {
      return { result: {} };
    }
    if (method === "tools/list") {
      return { result: { tools: [TOOL_DEFINITION] } };
    }
    if (method === "tools/call") {
      return { result: await callTool(message.params) };
    }
    return { error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (error) {
    if (error instanceof ProtocolError) {
      return { error: { code: error.protocolCode, message: error.message } };
    }
    const mapped = mapThrown(error);
    if (mapped instanceof ProtocolError) {
      return { error: { code: mapped.protocolCode, message: mapped.message } };
    }
    return {
      result: toolResult(
        { status: "error", error: { code: mapped.code, message: mapped.message } },
        true,
      ),
    };
  }
}

async function main() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    if (message.id === undefined) {
      continue;
    }
    const body = await handleMessage(message);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, ...body })}\n`);
  }
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    process.stderr.write(`MCP server failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
