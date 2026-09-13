/**
 * AUTHOR HOOK — domain spec schema.
 *
 * Mechanical path/id uniqueness and aesthetic rejection live in lib/spec-base.mjs.
 * Replace SPEC_KEYS / SLOT_KEYS / parseSlot with the product's technical fields.
 * Changing those fields must change parse or comparison results.
 */
import { parseSpecDocument } from "../lib/spec-base.mjs";

export const SPEC_KEYS = new Set(["id", "version", "title", "description", "slots"]);
export const SLOT_KEYS = new Set(["id", "path", "name", "required"]);

export function parseSpec(spec, specPath) {
  return parseSpecDocument(spec, specPath, {
    specKeys: SPEC_KEYS,
    slotKeys: SLOT_KEYS,
    requiredSlotFields: ["id", "path", "required"],
  });
}

export function loadSpec(raw, specPath) {
  return parseSpec(JSON.parse(raw), specPath);
}
