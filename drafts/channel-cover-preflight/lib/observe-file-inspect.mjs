/**
 * Shared File Vitals JSONL inspect client.
 *
 * Observation only: org.openadam.file.inspect@0.1.0. Not raster.verify.
 * JSONL admission is 16 concurrent inspects per session; this client pages
 * instead of truncating.
 */
import { spawn } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { findWorkspace } from "./workspace.mjs";
import { checkRecord } from "./check-record.mjs";

export const JSONL_BATCH_LIMIT = 16;
export const OBSERVER = {
  capability: "org.openadam.file.inspect@0.1.0",
  operation: "inspect",
  provider: "io.github.tetracoralla.file-vitals",
  transport: "openadam.capability-jsonl.v0.1",
  note: "Observation only. Comparison is ordinary combinator code, not raster.verify.",
};

export const FORMAT_ALIASES = {
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

export function normalizeFormat(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const key = String(value).trim().toLowerCase();
  return FORMAT_ALIASES[key] ?? key;
}

export function observedAlpha(image) {
  if (!image || image.has_alpha === undefined || image.has_alpha === null) {
    return "unknown";
  }
  return image.has_alpha ? "present" : "absent";
}

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

export function inspectPathForGrant(workspaceRoot, deliveryRoot, slotPath) {
  const absolute = resolve(deliveryRoot, slotPath);
  if (isOutside(deliveryRoot, absolute)) {
    throw new Error(`slot path escapes delivery root: ${slotPath}`);
  }
  if (isOutside(workspaceRoot, absolute)) {
    throw new Error(`delivery file is outside the inspect grant: ${slotPath}`);
  }
  return relative(workspaceRoot, absolute).split(sep).join("/");
}

export function observationQualityChecks(slot, response) {
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

export function inspectError(response) {
  if (!response) {
    return { code: "INSPECTION_FAILED", message: "No JSONL response for this path." };
  }
  if (response.ok === false && response.error) {
    return { code: response.error.code ?? "INSPECTION_FAILED", message: response.error.message ?? "inspect failed" };
  }
  return null;
}

export function observationFields(response) {
  const error = inspectError(response);
  const result = response?.ok ? response.result : null;
  return {
    error,
    result,
    fileName: result?.file?.name ?? null,
    format: normalizeFormat(result?.identity?.format) ?? normalizeFormat(result?.identity?.media_type),
    width: result?.image?.width ?? null,
    height: result?.image?.height ?? null,
    alpha: result ? observedAlpha(result.image) : "unknown",
    file: result?.file ?? null,
    identity: result?.identity
      ? {
          format: result.identity.format ?? null,
          media_type: result.identity.media_type ?? null,
          extension_match: result.identity.extension_match ?? null,
        }
      : null,
    image: result?.image ?? null,
  };
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

export async function inspectAll(adapter, workspaceRoot, paths) {
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

async function isExecutableFile(path) {
  try {
    await access(path, fsConstants.X_OK);
    const info = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function resolveAdapter(explicit, { projectRoot } = {}) {
  const candidates = [explicit, process.env.FILE_VITALS_ADAPTER].filter(Boolean);
  if (projectRoot) {
    candidates.push(join(projectRoot, "bin", "capability-adapter"));
    try {
      const workspace = await findWorkspace(projectRoot);
      candidates.push(
        join(workspace, "drafts", "asset-delivery-preflight", "bin", "capability-adapter"),
      );
    } catch {
      // workspace discovery is optional for adapter search
    }
  }
  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (await isExecutableFile(resolved)) {
      return resolved;
    }
  }
  throw new Error(
    `File Vitals JSONL adapter not found. Build it with scripts/build-file-vitals.sh (needs Go 1.26.6+). Looked at: ${candidates.join(", ") || "(none)"}`,
  );
}


