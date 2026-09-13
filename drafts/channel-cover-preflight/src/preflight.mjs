/**
 * Mechanical combinator: list files, inspect present declared paths with
 * file.inspect, then call the author's compareSlot / extraFiles.
 *
 * Missing required slots and extra files are recorded here.
 * Present-file comparison is author-owned (`src/compare.mjs`).
 */
import { checkRecord } from "../lib/check-record.mjs";
import { listRegularFiles } from "../lib/list-delivery-files.mjs";
import { inspectAll, observationFields, OBSERVER } from "../lib/observe-file-inspect.mjs";
import { compareSlot, extraFiles } from "./compare.mjs";

export { parseSpec, loadSpec } from "./spec.mjs";

export async function runPreflight({ spec, root, adapter, workspaceRoot }) {
  const diskFiles = await listRegularFiles(root);
  const diskSet = new Set(diskFiles);
  const declaredPaths = new Set(spec.slots.map((slot) => slot.path));
  const inspectPaths = spec.slots.filter((slot) => diskSet.has(slot.path)).map((slot) => slot.path);
  if (inspectPaths.length > 0 && !adapter) {
    throw new Error("File Vitals JSONL adapter is required when declared files are present.");
  }
  const responses = inspectPaths.length === 0
    ? new Map()
    : await inspectAll(adapter, workspaceRoot, inspectPaths);

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
    const observed = observationFields(responses.get(slot.path));
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
