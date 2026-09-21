/**
 * Two-layer combinator: a campaign kit list dispatched to existing
 * asset-delivery-preflight and channel-cover-preflight runPreflight.
 *
 * Upper layer owns: kit presence, method identity, aggregation, localization.
 * Lower layer owns: slot comparison (name/format/width/height/alpha/aspect/…).
 * Observation remains org.openadam.file.inspect@0.1.0 per kit root.
 * Not raster.verify. Not Direct Runtime nesting.
 */
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { LOWER, loadLower } from "./lower.mjs";

export const OBSERVER = {
  capability: "org.openadam.file.inspect@0.1.0",
  operation: "inspect",
  provider: "io.github.tetracoralla.file-vitals",
  transport: "openadam.capability-jsonl.v0.1",
  note: "Observation stays file.inspect via the lower combinators. Each kit inspect grant is that kit's root, not the campaign root. Comparison is the lower method, not raster.verify.",
};

export function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

/**
 * Require every symlink on the path from grantCanonical to lexicalPath, and
 * the final realpath, to stay inside grantCanonical. Lower methods inherit
 * or tighten this grant; they never receive an escaped realpath as a new grant.
 */
export async function realpathInsideGrant(grantCanonical, lexicalPath, label) {
  const absolute = resolve(lexicalPath);
  if (isOutside(grantCanonical, absolute)) {
    throw new Error(`${label} escapes the workspace grant: ${lexicalPath}`);
  }
  const rel = relative(grantCanonical, absolute);
  const parts = rel.split(sep).filter(Boolean);
  let current = grantCanonical;
  for (const part of parts) {
    current = resolve(current, part);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw error;
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      let target;
      try {
        target = await realpath(current);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          throw new Error(`${label} dangling symlink is outside a usable grant: ${current}`);
        }
        throw error;
      }
      if (isOutside(grantCanonical, target)) {
        throw new Error(`${label} resolves outside the workspace grant: ${lexicalPath}`);
      }
      current = target;
    }
  }
  const canonical = await realpath(absolute);
  if (isOutside(grantCanonical, canonical)) {
    throw new Error(`${label} resolves outside the workspace grant: ${lexicalPath}`);
  }
  return canonical;
}

async function directoryIfPresent(path) {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function liftCheck(kitId, check) {
  const record = {
    id: check.id,
    kit: kitId,
    passed: check.passed,
    expected: check.expected ?? null,
    observed: check.observed ?? null,
  };
  if (check.slot) {
    record.slot = check.slot;
  }
  if (check.path) {
    record.path = check.path;
  }
  if (check.error) {
    record.error = check.error;
  }
  return record;
}

function kitMissingCheck(kit) {
  return {
    id: "kitMissing",
    kit: kit.id,
    path: kit.root,
    expected: "directory",
    observed: null,
    passed: false,
  };
}

function failedFrom(checks) {
  return checks.filter((check) => !check.passed);
}

export async function runPreflight({ spec, root, adapter, workspaceRoot }) {
  const campaignRoot = resolve(root);
  const grantCanonical = await realpath(workspaceRoot ?? campaignRoot);
  const campaignCanonical = await realpath(campaignRoot);
  if (isOutside(grantCanonical, campaignCanonical)) {
    throw new Error(`campaign root resolves outside the workspace grant: ${campaignRoot}`);
  }
  const checks = [];
  const kits = [];

  for (const kit of spec.kits) {
    const kitRoot = resolve(campaignCanonical, kit.root);
    if (isOutside(campaignCanonical, kitRoot)) {
      throw new Error(`kit ${kit.id} root escapes the campaign root: ${kit.root}`);
    }
    const present = await directoryIfPresent(kitRoot);
    const lowerMeta = LOWER[kit.kind];
    const method = {
      kit: kit.id,
      kind: kit.kind,
      implementation: lowerMeta.implementation,
      procedure: lowerMeta.procedure,
      resolvedPath: null,
      bindingMode: null,
    };

    if (!present) {
      if (kit.required) {
        const missing = kitMissingCheck(kit);
        checks.push(missing);
        kits.push({
          id: kit.id,
          kind: kit.kind,
          required: true,
          present: false,
          status: "fail",
          root: kitRoot,
          workspaceRoot: null,
          method,
          spec: { id: null, version: null, path: kit.specPath ?? null },
          summary: {
            slots: 0,
            files: 0,
            checks: 1,
            passed: 0,
            failed: 1,
            failedIds: ["kitMissing"],
          },
          failed: [missing],
          lower: null,
        });
      } else {
        kits.push({
          id: kit.id,
          kind: kit.kind,
          required: false,
          present: false,
          status: "skip",
          root: kitRoot,
          workspaceRoot: null,
          method,
          spec: { id: null, version: null, path: kit.specPath ?? null },
          summary: {
            slots: 0,
            files: 0,
            checks: 0,
            passed: 0,
            failed: 0,
            failedIds: [],
          },
          failed: [],
          lower: null,
        });
      }
      continue;
    }

    const lower = await loadLower(kit.kind);
    method.resolvedPath = lower.resolvedPath;
    method.bindingMode = lower.bindingMode;
    let kitSpec;
    if (Object.hasOwn(kit, "spec")) {
      kitSpec = lower.parseSpec(kit.spec, `${kit.id}.spec`);
      kitSpec._path = null;
    } else {
      const specDir = spec._specDir ?? campaignCanonical;
      const specDirCanonical = await realpath(specDir);
      const specFile = resolve(specDirCanonical, kit.specPath);
      if (isOutside(specDirCanonical, specFile)) {
        throw new Error(`kit ${kit.id} specPath escapes the campaign spec directory: ${kit.specPath}`);
      }
      const specCanonical = await realpathInsideGrant(
        specDirCanonical,
        specFile,
        `kit ${kit.id} specPath`,
      );
      kitSpec = lower.parseSpec(JSON.parse(await readFile(specCanonical, "utf8")), specCanonical);
      kitSpec._path = specCanonical;
    }

    const inspectRoot = await realpathInsideGrant(
      campaignCanonical,
      kitRoot,
      `kit ${kit.id} root`,
    );
    if (isOutside(grantCanonical, inspectRoot)) {
      throw new Error(`kit ${kit.id} root resolves outside the workspace grant: ${kit.root}`);
    }
    const lowerReport = await lower.runPreflight({
      spec: kitSpec,
      root: inspectRoot,
      adapter,
      workspaceRoot: inspectRoot,
    });

    const lifted = (lowerReport.checks ?? []).map((check) => liftCheck(kit.id, check));
    checks.push(...lifted);
    const failed = failedFrom(lifted);
    kits.push({
      id: kit.id,
      kind: kit.kind,
      required: kit.required,
      present: true,
      status: lowerReport.status,
      root: inspectRoot,
      workspaceRoot: lowerReport.workspaceRoot,
      method,
      spec: lowerReport.spec,
      summary: lowerReport.summary,
      failed,
      lower: {
        status: lowerReport.status,
        observer: lowerReport.observer,
        summary: lowerReport.summary,
      },
    });
  }

  const failed = failedFrom(checks);
  const failedKits = kits.filter((kit) => kit.status === "fail").map((kit) => kit.id);
  return {
    status: failed.length === 0 ? "pass" : "fail",
    spec: { id: spec.id ?? null, version: spec.version ?? null, path: spec._path ?? null },
    root: campaignRoot,
    workspaceRoot: workspaceRoot ?? campaignRoot,
    observer: {
      ...OBSERVER,
      adapter: adapter ?? null,
    },
    methods: kits.map((kit) => kit.method),
    kits,
    checks,
    summary: {
      kits: spec.kits.length,
      present: kits.filter((kit) => kit.present).length,
      missing: kits.filter((kit) => kit.required && !kit.present).length,
      failedKits,
      checks: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      failedIds: [...new Set(failed.map((check) => check.id))],
    },
  };
}
