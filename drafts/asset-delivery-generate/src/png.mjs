/**
 * Bounded 8-bit PNG decode / cover-crop downscale / encode.
 *
 * Ordinary image code for this draft. Not org.openadam.raster.prepare,
 * not asset-prep, and not a public Capability provider.
 */
import { crc32, deflateSync, inflateSync } from "node:zlib";

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_DIMENSION = 4096;
export const MAX_PIXELS = 4096 * 4096;

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

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

function readChunk(buffer, offset) {
  if (offset + 12 > buffer.length) {
    throw new Error("truncated PNG chunk header");
  }
  const length = buffer.readUInt32BE(offset);
  const type = buffer.subarray(offset + 4, offset + 8).toString("binary");
  const dataStart = offset + 8;
  const dataEnd = dataStart + length;
  const crcEnd = dataEnd + 4;
  if (crcEnd > buffer.length) {
    throw new Error(`truncated PNG chunk ${type}`);
  }
  const data = buffer.subarray(dataStart, dataEnd);
  const expectedCrc = buffer.readUInt32BE(dataEnd);
  const actualCrc = crc32(buffer.subarray(offset + 4, dataEnd)) >>> 0;
  if (actualCrc !== expectedCrc) {
    throw new Error(`PNG chunk ${type} CRC mismatch`);
  }
  return { type, data, next: crcEnd };
}

function unfilter(inflated, width, height, channels) {
  const stride = width * channels;
  const rowBytes = stride + 1;
  if (inflated.length !== rowBytes * height) {
    throw new Error("PNG IDAT size does not match IHDR");
  }
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[y * rowBytes];
    const srcRow = y * rowBytes + 1;
    const dstRow = y * stride;
    const prevRow = y === 0 ? null : (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[srcRow + x];
      const a = x >= channels ? out[dstRow + x - channels] : 0;
      const b = prevRow === null ? 0 : out[prevRow + x];
      const c = prevRow === null || x < channels ? 0 : out[prevRow + x - channels];
      let recon;
      switch (filter) {
        case 0:
          recon = raw;
          break;
        case 1:
          recon = (raw + a) & 255;
          break;
        case 2:
          recon = (raw + b) & 255;
          break;
        case 3:
          recon = (raw + ((a + b) >> 1)) & 255;
          break;
        case 4:
          recon = (raw + paethPredictor(a, b, c)) & 255;
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      out[dstRow + x] = recon;
    }
  }
  return out;
}

export function decodePng(buffer) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new Error("PNG bytes are required");
  }
  const bytes = Buffer.from(buffer);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("not a PNG (signature mismatch)");
  }
  let offset = 8;
  let header = null;
  const idatParts = [];
  let sawIdat = false;
  let ended = false;
  while (offset < bytes.length) {
    const chunk = readChunk(bytes, offset);
    offset = chunk.next;
    if (ended) {
      throw new Error("PNG data after IEND");
    }
    if (chunk.type === "IHDR") {
      if (header) {
        throw new Error("duplicate IHDR");
      }
      if (chunk.data.length !== 13) {
        throw new Error("invalid IHDR");
      }
      const width = chunk.data.readUInt32BE(0);
      const height = chunk.data.readUInt32BE(4);
      const bitDepth = chunk.data[8];
      const colorType = chunk.data[9];
      const compression = chunk.data[10];
      const filter = chunk.data[11];
      const interlace = chunk.data[12];
      assertDimension(width, height, "PNG");
      if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || compression !== 0 || filter !== 0 || interlace !== 0) {
        throw new Error("only non-interlaced 8-bit RGB/RGBA PNG is supported");
      }
      header = { width, height, colorType, channels: colorType === 6 ? 4 : 3 };
      continue;
    }
    if (!header) {
      throw new Error("PNG chunk before IHDR");
    }
    if (chunk.type === "IDAT") {
      sawIdat = true;
      idatParts.push(chunk.data);
      continue;
    }
    if (chunk.type === "IEND") {
      ended = true;
      continue;
    }
    if (chunk.type === "PLTE" || chunk.type === "tRNS") {
      throw new Error(`unsupported PNG chunk ${chunk.type}`);
    }
    const ancillary = (chunk.type.charCodeAt(0) & 0x20) !== 0;
    if (!ancillary) {
      throw new Error(`unsupported critical PNG chunk ${chunk.type}`);
    }
  }
  if (!ended || !sawIdat || !header) {
    throw new Error("incomplete PNG");
  }
  const inflated = inflateSync(Buffer.concat(idatParts));
  const data = unfilter(inflated, header.width, header.height, header.channels);
  return {
    width: header.width,
    height: header.height,
    channels: header.channels,
    colorType: header.colorType,
    data,
  };
}

function writeChunk(type, data) {
  const typeBytes = Buffer.from(type, "binary");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])) >>> 0, 0);
  return Buffer.concat([length, typeBytes, data, crc]);
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
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dst = y * (stride + 1);
    raw[dst] = 0;
    raw.set(data.subarray(y * stride, y * stride + stride), dst + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    PNG_SIGNATURE,
    writeChunk("IHDR", ihdr),
    writeChunk("IDAT", idat),
    writeChunk("IEND", Buffer.alloc(0)),
  ]);
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

export function resampleArea(image, crop, destWidth, destHeight) {
  assertDimension(destWidth, destHeight, "resample");
  const { width: srcWidth, channels, data } = image;
  const dest = new Uint8Array(destWidth * destHeight * channels);
  const cropXEnd = crop.x + crop.width;
  const cropYEnd = crop.y + crop.height;
  for (let dy = 0; dy < destHeight; dy += 1) {
    const y0 = crop.y + Math.floor((dy * crop.height) / destHeight);
    const y1 = Math.min(cropYEnd, Math.max(y0 + 1, crop.y + Math.floor(((dy + 1) * crop.height) / destHeight)));
    for (let dx = 0; dx < destWidth; dx += 1) {
      const x0 = crop.x + Math.floor((dx * crop.width) / destWidth);
      const x1 = Math.min(cropXEnd, Math.max(x0 + 1, crop.x + Math.floor(((dx + 1) * crop.width) / destWidth)));
      const sums = new Float64Array(channels);
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const si = (y * srcWidth + x) * channels;
          for (let c = 0; c < channels; c += 1) {
            sums[c] += data[si + c];
          }
          count += 1;
        }
      }
      const di = (dy * destWidth + dx) * channels;
      const denom = count === 0 ? 1 : count;
      for (let c = 0; c < channels; c += 1) {
        dest[di + c] = Math.round(sums[c] / denom);
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
