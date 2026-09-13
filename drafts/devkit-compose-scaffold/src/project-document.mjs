/**
 * Scaffold-local agent-tool.json checks.
 *
 * This is a subset of Developer Kit validateProjectDocument / loadProject
 * (pinned in deps/pins.json as agentToolDevelopmentKit). Init no longer
 * imports Kit internal source. Full schema + pack still need a Kit clone
 * (`openadam-dev check` / `pack`, docs/CLEAN_ENV.md).
 */
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep, win32 } from "node:path";
import { ComposeScaffoldError } from "./errors.mjs";

export const PROJECT_FILE = "agent-tool.json";
export const PROJECT_SCHEMA_VERSION = "openadam.agent-tool-project.v0.1";
const MAX_INPUT_BYTES = 1024 * 1024;

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) {
    throw new ComposeScaffoldError("PROJECT_CONTRADICTION", `${label} must be unique.`);
  }
}

export function requireRelativePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024 || value.includes("\0")) {
    throw new ComposeScaffoldError("PATH_INVALID", `${label} must be a non-empty bounded relative path.`);
  }
  if (isAbsolute(value) || win32.isAbsolute(value) || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) {
    throw new ComposeScaffoldError("PATH_NOT_RELATIVE", `${label} must be repository-relative.`);
  }
  const parts = value.replaceAll("\\", "/").split("/");
  if (parts.some((part) => part === "..")) {
    throw new ComposeScaffoldError("PATH_ESCAPE", `${label} may not traverse outside the repository.`);
  }
  return value;
}

function requireString(value, label, min, max) {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new ComposeScaffoldError(
      "PROJECT_SCHEMA_INVALID",
      `${label} must be a string from ${min} to ${max} characters.`,
    );
  }
  return value;
}

function inspectJsonValue(value, label) {
  let nodes = 0;
  function walk(current, depth) {
    nodes += 1;
    if (nodes > 4096 || depth > 16) {
      throw new ComposeScaffoldError("PROJECT_CONTRADICTION", `${label} exceeds the structural probe-input limit.`);
    }
    if (Array.isArray(current)) {
      for (const item of current) walk(item, depth + 1);
    } else if (current !== null && typeof current === "object") {
      for (const item of Object.values(current)) walk(item, depth + 1);
    }
  }
  walk(value, 0);
  if (Buffer.byteLength(JSON.stringify(value)) > 64 * 1024) {
    throw new ComposeScaffoldError("PROJECT_CONTRADICTION", `${label} exceeds the 65536-byte serialized probe-input limit.`);
  }
}

export function validateProjectDocument(document) {
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    throw new ComposeScaffoldError("PROJECT_SCHEMA_INVALID", "The project declaration must be an object.");
  }
  if (document.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ComposeScaffoldError(
      "PROJECT_SCHEMA_INVALID",
      `schemaVersion must be ${PROJECT_SCHEMA_VERSION}.`,
    );
  }
  requireString(document.id, "id", 1, 128);
  requireString(document.version, "version", 1, 64);
  requireString(document.name, "name", 1, 120);
  requireString(document.summary, "summary", 1, 280);
  if (document.documents === null || typeof document.documents !== "object") {
    throw new ComposeScaffoldError("PROJECT_SCHEMA_INVALID", "documents is required.");
  }
  requireRelativePath(document.documents.productModel, "product model path");
  requireRelativePath(document.documents.reviewContract, "review contract path");
  if (!Array.isArray(document.checks) || document.checks.length === 0) {
    throw new ComposeScaffoldError("PROJECT_SCHEMA_INVALID", "checks must be a non-empty array.");
  }
  if (!Array.isArray(document.carriers) || document.carriers.length === 0) {
    throw new ComposeScaffoldError("PROJECT_SCHEMA_INVALID", "carriers must be a non-empty array.");
  }
  requireUnique(document.checks.map((check) => check.id), "check ids");
  requireUnique(document.carriers.map((carrier) => `${carrier.kind}:${carrier.path}`), "carrier kind and path pairs");
  for (const carrier of document.carriers) {
    requireRelativePath(carrier.path, `${carrier.kind} carrier path`);
  }
  if (document.contracts?.capabilityProviderManifest !== undefined) {
    requireRelativePath(document.contracts.capabilityProviderManifest, "Capability provider manifest path");
    if (!document.checks.some((check) => check.lane === "capability-conformance")) {
      throw new ComposeScaffoldError(
        "PROJECT_CONTRADICTION",
        "A declared Capability provider manifest requires a capability-conformance check lane.",
      );
    }
  }
  if (document.contracts?.procedureImplementationManifest !== undefined) {
    requireRelativePath(document.contracts.procedureImplementationManifest, "Procedure implementation manifest path");
    if (!document.checks.some((check) => check.lane === "procedure-conformance")) {
      throw new ComposeScaffoldError(
        "PROJECT_CONTRADICTION",
        "A declared Procedure implementation manifest requires a procedure-conformance check lane.",
      );
    }
  }
  if (document.package !== undefined) {
    requireRelativePath(document.package.artifact, "package artifact path");
    requireRelativePath(document.package.integration, "package integration path");
    for (const [name, path] of Object.entries(document.package.legal ?? {}).filter(([key]) => key !== "spdx")) {
      requireRelativePath(path, `package legal ${name} path`);
    }
    requireUnique(
      Object.entries(document.package.legal ?? {}).filter(([key]) => key !== "spdx").map(([, path]) => path),
      "package legal file paths",
    );
    if (!Array.isArray(document.package.probes) || document.package.probes.length === 0) {
      throw new ComposeScaffoldError("PROJECT_SCHEMA_INVALID", "package.probes must be a non-empty array.");
    }
    requireUnique(document.package.probes.map((probe) => probe.id), "runtime probe ids");
    if (
      !document.package.probes.some((probe) => probe.expectation === "success")
      || !document.package.probes.some((probe) => probe.expectation !== "success")
    ) {
      throw new ComposeScaffoldError(
        "PROJECT_CONTRADICTION",
        "Runtime probes must include at least one expected success and one expected error.",
      );
    }
    for (const probe of document.package.probes) {
      inspectJsonValue(probe.arguments ?? {}, `runtime probe ${probe.id} arguments`);
    }
  }
  return document;
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

async function requireDirectory(path, label) {
  const absolute = resolve(path);
  let info;
  try {
    info = await stat(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new ComposeScaffoldError("ROOT_NOT_FOUND", `${label} was not found.`);
    }
    throw error;
  }
  if (!info.isDirectory()) {
    throw new ComposeScaffoldError("ROOT_INVALID", `${label} is not a directory.`);
  }
  return realpath(absolute);
}

async function resolveDeclaredFile(root, declaredPath, label) {
  const safe = requireRelativePath(declaredPath, label);
  const rootReal = await requireDirectory(root);
  const parts = safe.replaceAll("\\", "/").split("/").filter((part) => part !== "" && part !== ".");
  let current = rootReal;
  for (const part of parts) {
    current = resolve(current, part);
    if (!inside(rootReal, current)) {
      throw new ComposeScaffoldError("PATH_ESCAPE", `${label} escapes the repository.`);
    }
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new ComposeScaffoldError("FILE_NOT_FOUND", `${label} was not found.`, { path: safe });
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new ComposeScaffoldError("PATH_SYMLINK_REJECTED", `${label} may not contain a symbolic link.`, { path: safe });
    }
  }
  const targetReal = await realpath(current);
  if (!inside(rootReal, targetReal)) {
    throw new ComposeScaffoldError("PATH_ESCAPE", `${label} escapes the repository.`);
  }
  const info = await stat(targetReal);
  if (!info.isFile()) {
    throw new ComposeScaffoldError("FILE_INVALID", `${label} is not a regular file.`, { path: safe });
  }
  return targetReal;
}

export async function loadProject(root, declaredPath = PROJECT_FILE, { bindFiles = true } = {}) {
  const rootReal = await requireDirectory(root, "project root");
  const path = await resolveDeclaredFile(rootReal, declaredPath, "project declaration");
  const info = await stat(path);
  if (info.size > MAX_INPUT_BYTES) {
    throw new ComposeScaffoldError("INPUT_TOO_LARGE", `project declaration exceeds the ${MAX_INPUT_BYTES}-byte input limit.`);
  }
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ComposeScaffoldError("JSON_INVALID", "project declaration is not valid JSON.");
    }
    throw error;
  }
  const project = validateProjectDocument(document);
  if (bindFiles) {
    await resolveDeclaredFile(rootReal, project.documents.productModel, "product model");
    await resolveDeclaredFile(rootReal, project.documents.reviewContract, "review contract");
    for (const carrier of project.carriers) {
      await resolveDeclaredFile(rootReal, carrier.path, `${carrier.kind} carrier`);
    }
    if (project.contracts?.capabilityProviderManifest !== undefined) {
      await resolveDeclaredFile(rootReal, project.contracts.capabilityProviderManifest, "Capability provider manifest");
    }
    if (project.contracts?.procedureImplementationManifest !== undefined) {
      await resolveDeclaredFile(rootReal, project.contracts.procedureImplementationManifest, "Procedure implementation manifest");
    }
    if (project.package !== undefined) {
      await resolveDeclaredFile(rootReal, project.package.integration, "Agent Host integration");
    }
  }
  return { root: rootReal, path, project };
}
