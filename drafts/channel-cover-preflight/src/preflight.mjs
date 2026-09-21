/**
 * Mechanical combinator: list files, inspect present declared paths with
 * file.inspect, then call the author's compareSlot / extraFiles.
 *
 * Missing required slots and extra files are recorded here.
 * Present-file comparison is author-owned (`src/compare.mjs`).
 */
import { isAbsolute, relative, resolve, sep } from "node:path";
import { checkRecord } from "../lib/check-record.mjs";
import { listRegularFiles } from "../lib/list-delivery-files.mjs";
import {
  inspectAll,
  inspectPathForGrant,
  observationFields,
  observationQualityChecks,
  OBSERVER,
} from "../lib/observe-file-inspect.mjs";
import { compareSlot, extraFiles } from "./compare.mjs";

export { parseSpec, loadSpec } from "./spec.mjs";

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
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
  if (inspectPaths.length > 0 && !adapter) {
    throw new Error("File Vitals JSONL adapter is required when declared files are present.");
  }
  const responses = inspectPaths.length === 0
    ? new Map()
    : await inspectAll(adapter, inspectGrant, inspectPaths);

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
    const observed = observationFields(response);
    const compared = compareSlot(slot, observed, spec);
    if (!Array.isArray(compared)) {
      throw new Error("compareSlot must return an array of check records");
    }
    checks.push(...compared);
    slots.push({
      id: slot.id,
      path: slot.path,
      present: true,
      required: slot.required,
      inspectError: observed.error,
      inspectStatus: quality.status ?? null,
      integrity: quality.integrity ?? null,
      diagnostics: quality.diagnostics ?? [],
      file: observed.file,
      identity: observed.identity,
      image: observed.image,
    });
  }

  const extras = extraFiles(diskFiles, declaredPaths, spec);
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
      ...OBSERVER,
      adapter: adapter ?? null,
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
