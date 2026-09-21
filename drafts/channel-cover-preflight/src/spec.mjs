/**
 * Channel-cover spec schema (author-owned).
 *
 * Different from asset-delivery-preflight: family-level naming.pattern and
 * transparencyAllowed, per-slot aspect, mixed formats, optional slots.
 * No per-slot alpha enum and no exact basename field.
 */
import { parseSpecDocument } from "../lib/spec-base.mjs";

export const SPEC_KEYS = new Set([
  "id",
  "version",
  "title",
  "description",
  "family",
  "naming",
  "transparencyAllowed",
  "slots",
]);
export const SLOT_KEYS = new Set(["id", "path", "name", "aspect", "format", "width", "height", "required"]);
export const FORMAT_VALUES = new Set(["png", "jpeg", "gif", "webp"]);

export function reducedRatio(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return null;
  }
  let a = width;
  let b = height;
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return `${width / a}:${height / a}`;
}

export function parseAspect(value, label) {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,4}:[1-9][0-9]{0,4}$/u.test(value)) {
    throw new Error(`${label} must be W:H with positive integers`);
  }
  const [width, height] = value.split(":").map((part) => Number(part));
  return reducedRatio(width, height);
}

function parseNaming(naming, specPath) {
  if (naming === null || typeof naming !== "object" || Array.isArray(naming)) {
    throw new Error(`${specPath}.naming must be an object`);
  }
  const keys = Object.keys(naming);
  if (keys.length !== 1 || keys[0] !== "pattern") {
    throw new Error(`${specPath}.naming only supports pattern`);
  }
  if (typeof naming.pattern !== "string" || naming.pattern.length === 0 || naming.pattern.length > 256) {
    throw new Error(`${specPath}.naming.pattern must be a non-empty string`);
  }
  try {
    const compiled = new RegExp(naming.pattern);
    compiled.test("cover-1x1.png");
  } catch (error) {
    throw new Error(`${specPath}.naming.pattern is not a valid regular expression: ${error.message}`);
  }
}

export function parseSpec(spec, specPath) {
  return parseSpecDocument(spec, specPath, {
    specKeys: SPEC_KEYS,
    slotKeys: SLOT_KEYS,
    requiredSlotFields: ["id", "path", "aspect", "format", "width", "height", "required"],
    parseSpec(document, label) {
      if (document.family !== "channel-cover") {
        throw new Error(`${label}.family must be channel-cover`);
      }
      if (typeof document.transparencyAllowed !== "boolean") {
        throw new Error(`${label}.transparencyAllowed must be a boolean`);
      }
      parseNaming(document.naming, label);
    },
    parseSlot(slot, label) {
      slot.aspect = parseAspect(slot.aspect, `${label}.aspect`);
      if (typeof slot.format !== "string" || !FORMAT_VALUES.has(slot.format)) {
        throw new Error(`${label}.format must be one of ${[...FORMAT_VALUES].join(", ")}`);
      }
      if (!Number.isInteger(slot.width) || slot.width < 1 || !Number.isInteger(slot.height) || slot.height < 1) {
        throw new Error(`${label} width/height must be positive integers`);
      }
    },
  });
}

export function loadSpec(raw, specPath) {
  return parseSpec(JSON.parse(raw), specPath);
}
