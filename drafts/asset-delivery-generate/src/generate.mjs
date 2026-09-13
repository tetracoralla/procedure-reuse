/**
 * Write asset-delivery PNG slots from one source PNG into a new directory.
 *
 * Bounded ordinary code: decode, center cover-crop, downscale, encode.
 * Upscale is forbidden. Source bytes are never overwritten.
 *
 * Writes stay inside the output root after symlink resolution. Default
 * no-overwrite is an exclusive-create at write time, not only a prior
 * access() guess. I/O failures report the files this run actually left
 * on disk (accurate partial), rather than claiming all-or-nothing.
 *
 * Not org.openadam.raster.prepare, not brand-asset.prepare, not asset-prep.
 */
import { lstat, mkdir, open, readFile, realpath, stat, unlink } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
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
  write: {
    sourcePreserve: "realpath-and-inode",
    overwrite: "exclusive-create-unless-requested",
    partial: "report-remaining-written",
    sandbox: "not-an-os-sandbox",
  },
  note: "Local PNG cover-crop + downscale. Does not implement org.openadam.raster.prepare or org.openadam.brand-asset.prepare. Does not bind asset-prep.",
};

const SUPPORTED_SLOT_FORMATS = new Set(["png"]);
const OPEN_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0x20000;

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

export function isOutside(root, candidate) {
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

async function identifyFile(path) {
  const resolved = resolve(path);
  const info = await stat(resolved);
  if (!info.isFile()) {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceInvalid",
        code: "SOURCE_INVALID",
        path: resolved,
        message: `source is not a file: ${resolved}`,
      }),
    ]);
  }
  const real = await realpath(resolved);
  return { path: resolved, real, dev: info.dev, ino: info.ino };
}

async function wouldWriteSource(sourceId, dest) {
  try {
    const info = await stat(dest);
    if (info.dev === sourceId.dev && info.ino === sourceId.ino) {
      return true;
    }
  } catch {
    // dest may not exist
  }
  try {
    const real = await realpath(dest);
    if (real === sourceId.real) {
      return true;
    }
  } catch {
    // dest may be dangling or missing
  }
  try {
    const parentReal = await realpath(dirname(dest));
    if (join(parentReal, basename(dest)) === sourceId.real) {
      return true;
    }
  } catch {
    // parent may not exist yet
  }
  return false;
}

async function existingDestKind(dest) {
  try {
    const info = await lstat(dest);
    if (info.isSymbolicLink()) {
      return "symlink";
    }
    if (info.isFile()) {
      return "file";
    }
    if (info.isDirectory()) {
      return "directory";
    }
    return "other";
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "missing";
    }
    throw error;
  }
}

/**
 * Walk each path component of dest under outCanonical. Symlinks (including
 * dangling) must not send the write outside the canonical output root.
 */
export async function assertInsideOutputRoot(outCanonical, dest, { allowFinalSymlink = false } = {}) {
  if (isOutside(outCanonical, dest)) {
    throw new Error(`path escapes output directory: ${dest}`);
  }
  const rel = relative(outCanonical, dest);
  const parts = rel.split(sep).filter(Boolean);
  let current = outCanonical;
  for (let i = 0; i < parts.length; i += 1) {
    current = join(current, parts[i]);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    const isLast = i === parts.length - 1;
    if (info.isSymbolicLink()) {
      if (isLast && allowFinalSymlink) {
        return;
      }
      let target;
      try {
        target = await realpath(current);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          throw Object.assign(new Error(`dangling symlink in output path: ${current}`), {
            code: "PATH_FORBIDDEN",
          });
        }
        throw error;
      }
      if (isOutside(outCanonical, target)) {
        throw Object.assign(new Error(`symlink in output path escapes output directory: ${current}`), {
          code: "PATH_FORBIDDEN",
        });
      }
      current = target;
      continue;
    }
    if (!isLast && !info.isDirectory()) {
      throw new Error(`output path component is not a directory: ${current}`);
    }
  }
}

async function writeSlotFile(dest, bytes, { overwrite }) {
  const flags = overwrite
    ? fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC | OPEN_NOFOLLOW
    : fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | OPEN_NOFOLLOW;
  let handle;
  try {
    handle = await open(dest, flags, 0o644);
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw Object.assign(new Error(`output already exists (pass --overwrite to replace): ${dest}`), {
        code: "EEXIST",
      });
    }
    if (error && error.code === "ELOOP") {
      throw Object.assign(new Error(`refusing to follow symlink at output path: ${dest}`), {
        code: "PATH_FORBIDDEN",
      });
    }
    throw error;
  }
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

async function prepareDest(dest, { overwrite, outCanonical, sourceId }) {
  await assertInsideOutputRoot(outCanonical, dest, { allowFinalSymlink: true });
  const kind = await existingDestKind(dest);
  if (kind === "symlink") {
    if (!overwrite) {
      throw Object.assign(new Error(`output already exists (pass --overwrite to replace): ${dest}`), {
        code: "EEXIST",
      });
    }
    // Replace the link with a regular file inside the output root. Do not
    // follow it (following would write to the target, which may be outside).
    await unlink(dest);
    return;
  }
  if (await wouldWriteSource(sourceId, dest)) {
    throw Object.assign(new Error("refusing to write onto the source file"), { code: "SOURCE_PRESERVE" });
  }
  if (kind === "missing") {
    return;
  }
  if (kind === "directory" || kind === "other") {
    throw Object.assign(new Error(`output path is not a regular file: ${dest}`), { code: "OUTPUT_INVALID" });
  }
  if (!overwrite) {
    throw Object.assign(new Error(`output already exists (pass --overwrite to replace): ${dest}`), {
      code: "EEXIST",
    });
  }
}

function writtenRecord(item) {
  return {
    id: item.id,
    path: item.path,
    dest: item.dest,
    width: item.width,
    height: item.height,
    format: item.format,
    alpha: item.alpha,
    bytes: item.bytes,
  };
}

export async function runGenerate({ spec, source, out, overwrite = false }) {
  const sourcePath = resolve(source);
  const outRoot = resolve(out);
  let sourceBytes;
  try {
    sourceBytes = await readFile(sourcePath);
  } catch {
    throw new GenerateFailure([
      failureRecord({
        id: "sourceMissing",
        code: "SOURCE_NOT_FOUND",
        path: sourcePath,
        message: `source PNG not found: ${sourcePath}`,
      }),
    ]);
  }

  let sourceId;
  try {
    sourceId = await identifyFile(sourcePath);
  } catch (error) {
    if (error instanceof GenerateFailure) {
      throw error;
    }
    throw new GenerateFailure([
      failureRecord({
        id: "sourceInvalid",
        code: "SOURCE_INVALID",
        path: sourcePath,
        message: `source is not a usable file: ${error instanceof Error ? error.message : String(error)}`,
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

  const sourceMeta = sourceRecord(sourceId.real, image);
  const failures = [];
  const planned = [];
  const destRootForPlan = outRoot;
  for (const slot of spec.slots) {
    try {
      const raster = rasterizeSlot(image, slot);
      const dest = resolve(destRootForPlan, slot.path);
      if (isOutside(destRootForPlan, dest)) {
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
      if (await wouldWriteSource(sourceId, dest)) {
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
    throw new GenerateFailure(failures, { source: sourceMeta, output: { root: outRoot, written: [], partial: false } });
  }

  const written = [];
  try {
    await mkdir(outRoot, { recursive: true });
    const outCanonical = await realpath(outRoot);
    for (const item of planned) {
      const dest = resolve(outCanonical, relative(destRootForPlan, item.dest) || item.path);
      item.dest = dest;
      try {
        await prepareDest(dest, { overwrite, outCanonical, sourceId });
      } catch (error) {
        const code = error.code === "EEXIST" ? "OUTPUT_EXISTS" : error.code === "SOURCE_PRESERVE" ? "SOURCE_PRESERVE" : "PATH_FORBIDDEN";
        const id = code === "OUTPUT_EXISTS" ? "outputExists" : code === "SOURCE_PRESERVE" ? "sourceWouldBeOverwritten" : "pathEscape";
        throw new GenerateFailure(
          [
            failureRecord({
              id,
              code,
              slot: item.id,
              path: item.path,
              message: error instanceof Error ? error.message : String(error),
            }),
          ],
          { source: sourceMeta, output: { root: outRoot, written: [...written], partial: written.length > 0 } },
        );
      }
      await mkdir(dirname(dest), { recursive: true });
      await assertInsideOutputRoot(outCanonical, dest, { allowFinalSymlink: overwrite });
      try {
        await writeSlotFile(dest, item.png, { overwrite });
      } catch (error) {
        const code = error.code === "EEXIST" ? "OUTPUT_EXISTS" : error.code === "PATH_FORBIDDEN" ? "PATH_FORBIDDEN" : "WRITE_FAILED";
        const id = code === "OUTPUT_EXISTS" ? "outputExists" : code === "PATH_FORBIDDEN" ? "pathEscape" : "writeFailed";
        throw new GenerateFailure(
          [
            failureRecord({
              id,
              code,
              slot: item.id,
              path: item.path,
              message: error instanceof Error ? error.message : String(error),
            }),
          ],
          { source: sourceMeta, output: { root: outRoot, written: [...written], partial: written.length > 0 } },
        );
      }
      written.push(writtenRecord(item));
    }
  } catch (error) {
    if (error instanceof GenerateFailure) {
      throw error;
    }
    throw new GenerateFailure(
      [
        failureRecord({
          id: "writeFailed",
          code: "WRITE_FAILED",
          message: error instanceof Error ? error.message : String(error),
        }),
      ],
      { source: sourceMeta, output: { root: outRoot, written, partial: written.length > 0 } },
    );
  }

  return {
    status: "pass",
    generator: GENERATOR,
    source: sourceMeta,
    output: { root: outRoot, written, partial: false },
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
    slots: error.output?.written ?? [],
    failures: error.failures ?? [
      failureRecord({
        id: "generateFailed",
        code: "GENERATE_FAILED",
        message: error.message,
      }),
    ],
  };
}
