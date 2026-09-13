/**
 * Bounded 8-bit PNG decode / cover-crop downscale / encode.
 *
 * Decode and encode use vendored pngjs 7.0.0 (MIT). Downscale is a
 * documented premultiplied-alpha, area-weighted box filter in this file.
 * Not org.openadam.raster.prepare, not asset-prep, and not a public
 * Capability provider.
 *
 * Supported input/output: non-interlaced 8-bit RGB (color type 2) or
 * RGBA (color type 6) PNG only. Palette, grayscale, 16-bit, interlaced,
 * and APNG are rejected. Formats are not expanded.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { PNG } = require(join(dirname(fileURLToPath(import.meta.url)), "../third_party/pngjs/lib/png.js"));

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_DIMENSION = 4096;
export const MAX_PIXELS = 4096 * 4096;
export const MAX_INPUT_BYTES = 32 * 1024 * 1024;
export const PNG_CODEC = {
  implementation: "pngjs@7.0.0",
  filter: "premultiplied-alpha-area-box",
  note: "pngjs decodes/encodes 8-bit RGB/RGBA. Resample is an area-weighted box filter with premultiplied alpha. Transparent RGB does not tint visible color.",
};

function assertDimension(width, height, label) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`${label} width/height must be positive integers`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`${label} exceeds max dimension ${MAX_DIMENSION}`);
  }
  if (width * height > MAX_PIXELS) {
    throw new Error(`${label} exceeds max pixel count ${MAX_PIXELS}`);
  }
}

function admitPngBytes(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new Error("PNG bytes are required");
  }
  const bytes = Buffer.from(buffer);
  if (bytes.length > MAX_INPUT_BYTES) {
    throw new Error(`PNG exceeds max input size ${MAX_INPUT_BYTES} bytes`);
  }
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("not a PNG (signature mismatch)");
  }
  if (bytes.length < 33) {
    throw new Error("PNG missing IHDR");
  }
  const length = bytes.readUInt32BE(8);
  const type = bytes.subarray(12, 16).toString("binary");
  if (type !== "IHDR" || length !== 13) {
    throw new Error("PNG missing IHDR");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];
  assertDimension(width, height, "PNG");
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error("only non-interlaced 8-bit RGB/RGBA PNG is supported");
  }
  const channels = colorType === 6 ? 4 : 3;
  const maxInflated = (width * channels + 1) * height;
  if (maxInflated > MAX_INPUT_BYTES) {
    throw new Error(`PNG inflated raster would exceed ${MAX_INPUT_BYTES} bytes`);
  }
  return { bytes, width, height, colorType, channels };
}

function packRgb(rgba, width, height) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0, o = 0; i < rgba.length; i += 4, o += 3) {
    data[o] = rgba[i];
    data[o + 1] = rgba[i + 1];
    data[o + 2] = rgba[i + 2];
  }
  return data;
}

function expandRgb(rgb, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    data[o] = rgb[i];
    data[o + 1] = rgb[i + 1];
    data[o + 2] = rgb[i + 2];
    data[o + 3] = 255;
  }
  return data;
}

export function decodePng(buffer) {
  const admitted = admitPngBytes(buffer);
  let parsed;
  try {
    parsed = PNG.sync.read(admitted.bytes);
  } catch (error) {
    throw new Error(`source is not a usable 8-bit RGB/RGBA PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsed.colorType !== admitted.colorType || parsed.depth !== 8 || parsed.interlace) {
    throw new Error("only non-interlaced 8-bit RGB/RGBA PNG is supported");
  }
  if (parsed.width !== admitted.width || parsed.height !== admitted.height) {
    throw new Error("PNG IHDR does not match decoded raster");
  }
  const channels = admitted.channels;
  const data = channels === 4
    ? Uint8Array.from(parsed.data)
    : packRgb(parsed.data, parsed.width, parsed.height);
  return {
    width: parsed.width,
    height: parsed.height,
    channels,
    colorType: admitted.colorType,
    data,
  };
}

export function encodePng(image) {
  const { width, height, channels, data } = image;
  if (channels !== 3 && channels !== 4) {
    throw new Error("PNG encode supports RGB or RGBA only");
  }
  assertDimension(width, height, "PNG encode");
  if (!(data instanceof Uint8Array) || data.length !== width * height * channels) {
    throw new Error("PNG pixel buffer size mismatch");
  }
  const png = new PNG({ width, height, bitDepth: 8 });
  png.data = channels === 4 ? Buffer.from(data) : expandRgb(data, width, height);
  return PNG.sync.write(png, {
    colorType: channels === 4 ? 6 : 2,
    width,
    height,
    bitDepth: 8,
  });
}

export function coverCrop(srcWidth, srcHeight, destWidth, destHeight) {
  assertDimension(srcWidth, srcHeight, "source");
  assertDimension(destWidth, destHeight, "target");
  const srcAspect = srcWidth / srcHeight;
  const destAspect = destWidth / destHeight;
  let cropWidth;
  let cropHeight;
  if (srcAspect > destAspect) {
    cropHeight = srcHeight;
    cropWidth = Math.round(srcHeight * destAspect);
    if (cropWidth < 1) {
      cropWidth = 1;
    }
    if (cropWidth > srcWidth) {
      cropWidth = srcWidth;
    }
  } else {
    cropWidth = srcWidth;
    cropHeight = Math.round(srcWidth / destAspect);
    if (cropHeight < 1) {
      cropHeight = 1;
    }
    if (cropHeight > srcHeight) {
      cropHeight = srcHeight;
    }
  }
  const cropX = Math.floor((srcWidth - cropWidth) / 2);
  const cropY = Math.floor((srcHeight - cropHeight) / 2);
  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

export function needsUpscale(crop, destWidth, destHeight) {
  return crop.width < destWidth || crop.height < destHeight;
}

function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * Area-weighted box filter. RGBA uses premultiplied alpha so fully
 * transparent RGB does not contaminate the visible color.
 *
 * Dest pixel (dx, dy) covers the source rectangle
 *   [dx * crop.w / destW, (dx+1) * crop.w / destW]
 * × [dy * crop.h / destH, (dy+1) * crop.h / destH]
 * relative to the crop origin, including fractional edge pixels.
 */
export function resampleArea(image, crop, destWidth, destHeight) {
  assertDimension(destWidth, destHeight, "resample");
  const { width: srcWidth, height: srcHeight, channels, data } = image;
  if (crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1) {
    throw new Error("invalid crop");
  }
  if (crop.x + crop.width > srcWidth || crop.y + crop.height > srcHeight) {
    throw new Error("crop exceeds source");
  }
  const dest = new Uint8Array(destWidth * destHeight * channels);
  const hasAlpha = channels === 4;
  const cropXEnd = crop.x + crop.width;
  const cropYEnd = crop.y + crop.height;

  for (let dy = 0; dy < destHeight; dy += 1) {
    const yStart = crop.y + (dy * crop.height) / destHeight;
    const yEnd = crop.y + ((dy + 1) * crop.height) / destHeight;
    const y0 = Math.max(crop.y, Math.floor(yStart));
    const y1 = Math.min(cropYEnd, Math.ceil(yEnd));
    for (let dx = 0; dx < destWidth; dx += 1) {
      const xStart = crop.x + (dx * crop.width) / destWidth;
      const xEnd = crop.x + ((dx + 1) * crop.width) / destWidth;
      const x0 = Math.max(crop.x, Math.floor(xStart));
      const x1 = Math.min(cropXEnd, Math.ceil(xEnd));
      let area = 0;
      let alphaArea = 0;
      const premul = [0, 0, 0];
      const rgb = [0, 0, 0];
      for (let y = y0; y < y1; y += 1) {
        const yWeight = overlap(y, y + 1, yStart, yEnd);
        if (yWeight <= 0) {
          continue;
        }
        for (let x = x0; x < x1; x += 1) {
          const xWeight = overlap(x, x + 1, xStart, xEnd);
          if (xWeight <= 0) {
            continue;
          }
          const weight = xWeight * yWeight;
          const si = (y * srcWidth + x) * channels;
          area += weight;
          if (hasAlpha) {
            const a = data[si + 3] / 255;
            premul[0] += data[si] * a * weight;
            premul[1] += data[si + 1] * a * weight;
            premul[2] += data[si + 2] * a * weight;
            alphaArea += a * weight;
          } else {
            rgb[0] += data[si] * weight;
            rgb[1] += data[si + 1] * weight;
            rgb[2] += data[si + 2] * weight;
          }
        }
      }
      const di = (dy * destWidth + dx) * channels;
      if (hasAlpha) {
        const outAlpha = area === 0 ? 0 : alphaArea / area;
        dest[di + 3] = Math.round(outAlpha * 255);
        if (alphaArea <= 0) {
          dest[di] = 0;
          dest[di + 1] = 0;
          dest[di + 2] = 0;
        } else {
          dest[di] = Math.round(premul[0] / alphaArea);
          dest[di + 1] = Math.round(premul[1] / alphaArea);
          dest[di + 2] = Math.round(premul[2] / alphaArea);
        }
      } else {
        const denom = area === 0 ? 1 : area;
        dest[di] = Math.round(rgb[0] / denom);
        dest[di + 1] = Math.round(rgb[1] / denom);
        dest[di + 2] = Math.round(rgb[2] / denom);
      }
    }
  }
  return {
    width: destWidth,
    height: destHeight,
    channels,
    colorType: channels === 4 ? 6 : 2,
    data: dest,
  };
}

export function flattenOpaque(image, background = [255, 255, 255]) {
  if (image.channels === 3) {
    return image;
  }
  const data = new Uint8Array(image.width * image.height * 3);
  for (let i = 0, o = 0; i < image.data.length; i += 4, o += 3) {
    const alpha = image.data[i + 3] / 255;
    data[o] = Math.round(image.data[i] * alpha + background[0] * (1 - alpha));
    data[o + 1] = Math.round(image.data[i + 1] * alpha + background[1] * (1 - alpha));
    data[o + 2] = Math.round(image.data[i + 2] * alpha + background[2] * (1 - alpha));
  }
  return {
    width: image.width,
    height: image.height,
    channels: 3,
    colorType: 2,
    data,
  };
}

export function observedAlpha(image) {
  return image.channels === 4 ? "present" : "absent";
}

export function paintPattern(width, height, { alpha = true } = {}) {
  assertDimension(width, height, "pattern");
  const channels = alpha ? 4 : 3;
  const data = new Uint8Array(width * height * channels);
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      data[i] = x < midX ? 200 : 40;
      data[i + 1] = y < midY ? 180 : 50;
      data[i + 2] = 90;
      if (alpha) {
        data[i + 3] = x === 0 && y === 0 ? 0 : 255;
      }
    }
  }
  return {
    width,
    height,
    channels,
    colorType: channels === 4 ? 6 : 2,
    data,
  };
}
