import { basename, isAbsolute } from "node:path";

export const REJECTED_FIELDS = [
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

export function rejectAesthetic(label, object) {
  for (const key of Object.keys(object)) {
    const lower = key.toLowerCase();
    if (REJECTED_FIELDS.includes(lower) || lower.includes("aesthetic") || lower.includes("generate")) {
      throw new Error(`${label} contains forbidden field ${key} (technical preflight only; no brand/copy/generation)`);
    }
  }
}

export function assertKeys(label, object, allowed) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} has unsupported field ${key}`);
    }
  }
}

export function assertRelativePosixPath(value, label) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value) || value.includes("..") || value.includes("\\")) {
    throw new Error(`${label} must be a relative POSIX path without ..`);
  }
}

/**
 * Mechanical spec loader. The author extends allowed keys and parseSlot.
 * Slot path/id uniqueness and aesthetic rejection are always enforced.
 */
export function parseSpecDocument(spec, specPath, options) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("spec must be a JSON object");
  }
  rejectAesthetic(specPath, spec);
  assertKeys(specPath, spec, options.specKeys);
  if (!Array.isArray(spec.slots) || spec.slots.length === 0) {
    throw new Error("spec.slots must be a non-empty array");
  }
  const seenIds = new Set();
  const seenPaths = new Set();
  spec.slots.forEach((slot, index) => {
    const label = `${specPath} slots[${index}]`;
    if (slot === null || typeof slot !== "object" || Array.isArray(slot)) {
      throw new Error(`${label} must be an object`);
    }
    rejectAesthetic(label, slot);
    assertKeys(label, slot, options.slotKeys);
    for (const required of options.requiredSlotFields ?? ["id", "path", "required"]) {
      if (!(required in slot)) {
        throw new Error(`${label} missing ${required}`);
      }
    }
    if (typeof slot.id !== "string" || slot.id.length === 0) {
      throw new Error(`${label}.id must be a non-empty string`);
    }
    if (seenIds.has(slot.id)) {
      throw new Error(`${label}.id duplicates ${slot.id}`);
    }
    seenIds.add(slot.id);
    assertRelativePosixPath(slot.path, `${label}.path`);
    if (seenPaths.has(slot.path)) {
      throw new Error(`${label}.path duplicates ${slot.path}`);
    }
    seenPaths.add(slot.path);
    if (typeof slot.required !== "boolean") {
      throw new Error(`${label}.required must be a boolean`);
    }
    slot.name = slot.name ?? basename(slot.path);
    if (options.parseSlot) {
      options.parseSlot(slot, label, spec);
    }
  });
  if (options.parseSpec) {
    options.parseSpec(spec, specPath);
  }
  return spec;
}
