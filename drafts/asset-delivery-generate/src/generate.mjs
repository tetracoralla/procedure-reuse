/**
 * Write asset-delivery PNG slots from one source PNG into a new directory.
 *
 * Bounded ordinary code: decode, center cover-crop, downscale, encode.
 * Upscale is forbidden. Source bytes are never overwritten.
 *
 * Not org.openadam.raster.prepare, not brand-asset.prepare, not asset-prep.
 */
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  coverCrop,
  decodePng,
  encodePng,
  flattenOpaque,
  needsUpscale,
  observedAlpha,
  resampleArea,
} from "./png.mjs";

export const GENERATOR = {
  implementation: "org.openadam.asset-delivery-generate@0.1.0",
  kind: "ordinary-code",
  fit: "cover",
  upscale: "forbidden",
  formats: ["png"],
  note: "Local PNG cover-crop + downscale. Does not implement org.openadam.raster.prepare or org.openadam.brand-asset.prepare. Does not bind asset-prep.",
};

const SUPPORTED_SLOT_FORMATS = new Set(["png"]);

export class GenerateFailure extends Error {
  constructor(failures, extras = {}) {
    const first = failures[0];
    super(first?.message ?? "generate failed");
    this.name = "GenerateFailure";
    this.failures = failures;
    this.source = extras.source ?? null;
    this.output = extras.output ?? null;
  }
}

function isOutside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath);
}

function failureRecord({ id, code, message, slot, path, expected, observed }) {
  const record = { id, code, message, passed: false };
  if (slot) {
    record.slot = slot;
  }
  if (path) {
    record.path = path;
  }
  if (expected !== undefined) {
    record.expected = expected;
  }
  if (observed !== undefined) {
    record.observed = observed;
  }
  return record;
}

function sourceRecord(sourcePath, image) {
  return {
    path: sourcePath,
    width: image.width,
    height: image.height,
    format: "png",
    alpha: observedAlpha(image),
    channels: image.channels,
  };
}

export function rasterizeSlot(sourceImage, slot) {
  if (!SUPPORTED_SLOT_FORMATS.has(slot.format)) {
    throw new GenerateFailure([
      failureRecord({
        id: "slotFormatUnsupported",
        code: "SLOT_FORMAT_UNSUPPORTED",
        slot: slot.id,
        path: slot.path,
        expected: "png",
        observed: slot.format,
        message: `slot ${slot.id} format ${slot.format} is outside this generator (PNG only; not raster.prepare)`,
      }),
    ]);
  }
  if (slot.alpha === "unknown") {
    throw new GenerateFailure([
      failureRecord({
        id: "slotAlphaUnsatisfiable",
        code: "SLOT_ALPHA_UNSATISFIABLE",
        slot: slot.id,
        path: slot.path,
        expected: slot.alpha,
        observed: observedAlpha(sourceImage),
        message: `slot ${slot.id} wants alpha=unknown; PNG output always has a known alpha channel`,
      }),
    ]);
  }
  if (slot.alpha === "present" && sourceImage.channels !== 4) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceAlphaMissing",
        code: "SOURCE_ALPHA_MISSING",
        slot: slot.id,
        path: slot.path,
        expected: "present",
        observed: "absent",
        message: `slot ${slot.id} requires alpha=present but the source PNG has no alpha channel`,
      }),
    ]);
  }
  const crop = coverCrop(sourceImage.width, sourceImage.height, slot.width, slot.height);
  if (needsUpscale(crop, slot.width, slot.height)) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceTooSmall",
        code: "SOURCE_TOO_SMALL",
        slot: slot.id,
        path: slot.path,
        expected: { width: slot.width, height: slot.height },
        observed: { width: sourceImage.width, height: sourceImage.height, crop },
        message: `slot ${slot.id} is ${slot.width}×${slot.height} but source cover-crop is ${crop.width}×${crop.height}; upscale is forbidden`,
      }),
    ]);
  }
  let raster = resampleArea(sourceImage, crop, slot.width, slot.height);
  if (slot.alpha === "absent") {
    raster = flattenOpaque(raster);
  }
  const png = encodePng(raster);
  return {
    id: slot.id,
    path: slot.path,
    width: raster.width,
    height: raster.height,
    format: "png",
    alpha: observedAlpha(raster),
    bytes: png.length,
    png,
  };
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function runGenerate({ spec, source, out, overwrite = false }) {
  const sourcePath = resolve(source);
  const outRoot = resolve(out);
  let sourceBytes;
  try {
    sourceBytes = await readFile(sourcePath);
  } catch (error) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceMissing",
        code: "SOURCE_NOT_FOUND",
        path: sourcePath,
        message: `source PNG not found: ${sourcePath}`,
      }),
    ]);
  }
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceInvalid",
        code: "SOURCE_INVALID",
        path: sourcePath,
        message: `source is not a file: ${sourcePath}`,
      }),
    ]);
  }

  let image;
  try {
    image = decodePng(sourceBytes);
  } catch (error) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceInvalid",
        code: "SOURCE_INVALID",
        path: sourcePath,
        message: `source is not a usable 8-bit RGB/RGBA PNG: ${error.message}`,
      }),
    ]);
  }

  const sourceMeta = sourceRecord(sourcePath, image);
  const failures = [];
  const planned = [];
  for (const slot of spec.slots) {
    try {
      const raster = rasterizeSlot(image, slot);
      const dest = resolve(outRoot, slot.path);
      if (dest === sourcePath) {
        failures.push(
          failureRecord({
            id: "sourceWouldBeOverwritten",
            code: "SOURCE_PRESERVE",
            slot: slot.id,
            path: slot.path,
            message: `refusing to write slot ${slot.id} onto the source file`,
          }),
        );
        continue;
      }
      if (isOutside(outRoot, dest)) {
        failures.push(
          failureRecord({
            id: "pathEscape",
            code: "PATH_FORBIDDEN",
            slot: slot.id,
            path: slot.path,
            message: `slot path escapes output directory: ${slot.path}`,
          }),
        );
        continue;
      }
      planned.push({ ...raster, dest });
    } catch (error) {
      if (error instanceof GenerateFailure) {
        if (slot.required === false) {
          continue;
        }
        failures.push(...error.failures);
        continue;
      }
      throw error;
    }
  }

  if (failures.length > 0) {
    throw new GenerateFailure(failures, { source: sourceMeta, output: { root: outRoot, written: [] } });
  }

  if (!overwrite) {
    for (const item of planned) {
      if (await pathExists(item.dest)) {
        throw new GenerateFailure(
          [
            failureRecord({
              id: "outputExists",
              code: "OUTPUT_EXISTS",
              slot: item.id,
              path: item.path,
              message: `output already exists (pass --overwrite to replace): ${item.dest}`,
            }),
          ],
          { source: sourceMeta, output: { root: outRoot, written: [] } },
        );
      }
    }
  }

  await mkdir(outRoot, { recursive: true });
  const written = [];
  for (const item of planned) {
    await mkdir(dirname(item.dest), { recursive: true });
    await writeFile(item.dest, item.png);
    written.push({
      id: item.id,
      path: item.path,
      dest: item.dest,
      width: item.width,
      height: item.height,
      format: item.format,
      alpha: item.alpha,
      bytes: item.bytes,
    });
  }

  return {
    status: "pass",
    generator: GENERATOR,
    source: sourceMeta,
    output: { root: outRoot, written },
    slots: written,
    failures: [],
  };
}

export function generateReportFromFailure(error) {
  return {
    status: "fail",
    generator: GENERATOR,
    source: error.source ?? null,
    output: error.output ?? null,
    slots: [],
    failures: error.failures ?? [
      failureRecord({
        id: "generateFailed",
        code: "GENERATE_FAILED",
        message: error.message,
      }),
    ],
  };
}
