/**
 * Channel-cover comparison rules (author-owned).
 *
 * Check ids: namePattern, format, width, height, aspect, transparency,
 * plus mechanical missing/extra from the orchestrator.
 *
 * Not copied from asset-delivery-preflight (no per-slot alpha/name equality).
 */
import { checkRecord } from "../lib/check-record.mjs";
import { reducedRatio } from "./spec.mjs";

function transparencyPassed(allowed, observed) {
  if (allowed) {
    return true;
  }
  return observed !== "present" && observed !== "unknown";
}

export function compareSlot(slot, observation, spec) {
  const error = observation.error;
  const fileName = observation.fileName;
  const checks = [];
  const pattern = spec.naming.pattern;
  const nameOk = !error && typeof fileName === "string" && new RegExp(pattern).test(fileName);

  checks.push(
    checkRecord({
      id: "namePattern",
      slot: slot.id,
      path: slot.path,
      expected: pattern,
      observed: fileName,
      passed: Boolean(nameOk),
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "format",
      slot: slot.id,
      path: slot.path,
      expected: slot.format,
      observed: observation.format,
      passed: !error && observation.format === slot.format,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "width",
      slot: slot.id,
      path: slot.path,
      expected: slot.width,
      observed: observation.width,
      passed: !error && observation.width === slot.width,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "height",
      slot: slot.id,
      path: slot.path,
      expected: slot.height,
      observed: observation.height,
      passed: !error && observation.height === slot.height,
      error,
    }),
  );
  const observedAspect = reducedRatio(observation.width, observation.height);
  checks.push(
    checkRecord({
      id: "aspect",
      slot: slot.id,
      path: slot.path,
      expected: slot.aspect,
      observed: observedAspect,
      passed: !error && observedAspect === slot.aspect,
      error,
    }),
  );
  checks.push(
    checkRecord({
      id: "transparency",
      slot: slot.id,
      path: slot.path,
      expected: spec.transparencyAllowed ? "allowed" : "forbidden",
      observed: observation.alpha,
      passed: !error && transparencyPassed(spec.transparencyAllowed, observation.alpha),
      error,
    }),
  );
  return checks;
}

export function extraFiles(diskFiles, declaredPaths, _spec) {
  return diskFiles.filter((path) => !declaredPaths.has(path));
}
