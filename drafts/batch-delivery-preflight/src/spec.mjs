/**
 * Batch/campaign spec. This is a kit list, not a slot list.
 *
 * Slot comparison lives in the lower methods. This file only validates
 * campaign identity, kit kind, and path/id uniqueness.
 */
import { isAbsolute } from "node:path";

export const FAMILY = "batch-delivery";
export const KINDS = new Set(["asset-delivery", "channel-cover"]);
export const MAX_KITS = 8;

const SPEC_KEYS = new Set(["id", "version", "title", "description", "family", "kits"]);
const KIT_KEYS = new Set(["id", "kind", "required", "root", "spec", "specPath"]);
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
  "caption",
  "copy",
  "headline",
  "generate",
  "resize",
  "autoGenerate",
];

function rejectAesthetic(label, object) {
  for (const key of Object.keys(object)) {
    const lower = key.toLowerCase();
    if (REJECTED_FIELDS.includes(lower) || lower.includes("aesthetic") || lower.includes("generate")) {
      throw new Error(`${label} contains forbidden field ${key} (technical preflight only; no brand/copy/generation)`);
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

export function assertRelativePosixPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) || value.includes("..") || value.includes("\\") || value.includes("\0")) {
    throw new Error(`${label} must be a relative POSIX path without ..`);
  }
}

export function parseSpec(spec, specPath) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("spec must be a JSON object");
  }
  rejectAesthetic(specPath, spec);
  assertKeys(specPath, spec, SPEC_KEYS);
  if (spec.family !== FAMILY) {
    throw new Error(`${specPath}.family must be ${FAMILY}`);
  }
  if (!Array.isArray(spec.kits) || spec.kits.length === 0) {
    throw new Error(`${specPath}.kits must be a non-empty array`);
  }
  if (spec.kits.length > MAX_KITS) {
    throw new Error(`${specPath}.kits exceeds the bound of ${MAX_KITS}`);
  }

  const seenIds = new Set();
  const seenRoots = new Set();
  spec.kits.forEach((kit, index) => {
    const label = `${specPath} kits[${index}]`;
    if (kit === null || typeof kit !== "object" || Array.isArray(kit)) {
      throw new Error(`${label} must be an object`);
    }
    rejectAesthetic(label, kit);
    assertKeys(label, kit, KIT_KEYS);
    for (const required of ["id", "kind", "required", "root"]) {
      if (!(required in kit)) {
        throw new Error(`${label} missing ${required}`);
      }
    }
    if (typeof kit.id !== "string" || kit.id.length === 0) {
      throw new Error(`${label}.id must be a non-empty string`);
    }
    if (seenIds.has(kit.id)) {
      throw new Error(`${label}.id duplicates ${kit.id}`);
    }
    seenIds.add(kit.id);
    if (typeof kit.kind !== "string" || !KINDS.has(kit.kind)) {
      throw new Error(`${label}.kind must be one of ${[...KINDS].join(", ")}`);
    }
    if (typeof kit.required !== "boolean") {
      throw new Error(`${label}.required must be a boolean`);
    }
    assertRelativePosixPath(kit.root, `${label}.root`);
    if (seenRoots.has(kit.root)) {
      throw new Error(`${label}.root duplicates ${kit.root}`);
    }
    seenRoots.add(kit.root);

    const hasSpec = Object.hasOwn(kit, "spec");
    const hasSpecPath = Object.hasOwn(kit, "specPath");
    if (hasSpec === hasSpecPath) {
      throw new Error(`${label} must include exactly one of spec or specPath`);
    }
    if (hasSpecPath) {
      assertRelativePosixPath(kit.specPath, `${label}.specPath`);
    }
    if (hasSpec && (kit.spec === null || typeof kit.spec !== "object" || Array.isArray(kit.spec))) {
      throw new Error(`${label}.spec must be an object`);
    }
  });
  return spec;
}

export function loadSpec(raw, specPath) {
  return parseSpec(JSON.parse(raw), specPath);
}
