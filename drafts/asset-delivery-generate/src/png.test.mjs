#!/usr/bin/env node
/**
 * Pixel-level PNG tests. First shows the 0ea5124 handwritten filter was
 * wrong on the reviewer cases, then checks the replacement.
 */
import assert from "node:assert/strict";
import { deflateSync, inflateSync } from "node:zlib";
import test from "node:test";
import {
  decodePng,
  encodePng,
  MAX_DIMENSION,
  MAX_INPUT_BYTES,
  PNG_CODEC,
  PNG_SIGNATURE,
  resampleArea,
} from "./png.mjs";

function image(width, height, channels, pixels) {
  return {
    width,
    height,
    channels,
    colorType: channels === 4 ? 6 : 2,
    data: Uint8Array.from(pixels),
  };
}

/** Independent RGBA average as in 0ea5124 resampleArea (pixel count, no premul). */
function legacyResampleIndependentAverage(img, crop, destWidth, destHeight) {
  const { width: srcWidth, channels, data } = img;
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
  return dest;
}

test("codec identity is pngjs, not an expanded handwritten decoder", () => {
  assert.equal(PNG_CODEC.implementation, "pngjs@7.0.0");
  assert.match(PNG_CODEC.filter, /premultiplied-alpha-area-box/);
});

test("legacy independent average contaminates red with transparent blue (reviewer case)", () => {
  const src = image(2, 1, 4, [255, 0, 0, 255, 0, 0, 255, 0]);
  const crop = { x: 0, y: 0, width: 2, height: 1 };
  const legacy = legacyResampleIndependentAverage(src, crop, 1, 1);
  assert.deepEqual([...legacy], [128, 0, 128, 128]);
});

test("premultiplied area box keeps opaque red when mixed with transparent blue", () => {
  const src = image(2, 1, 4, [255, 0, 0, 255, 0, 0, 255, 0]);
  const out = resampleArea(src, { x: 0, y: 0, width: 2, height: 1 }, 1, 1);
  assert.deepEqual([...out.data], [255, 0, 0, 128]);
});

test("legacy 3-to-2 black-white-black is not area-weighted (reviewer case)", () => {
  const src = image(3, 1, 3, [0, 0, 0, 255, 255, 255, 0, 0, 0]);
  const legacy = legacyResampleIndependentAverage(src, { x: 0, y: 0, width: 3, height: 1 }, 2, 1);
  assert.deepEqual([...legacy], [0, 0, 0, 128, 128, 128]);
});

test("area-weighted 3-to-2 black-white-black is symmetric", () => {
  const src = image(3, 1, 3, [0, 0, 0, 255, 255, 255, 0, 0, 0]);
  const out = resampleArea(src, { x: 0, y: 0, width: 3, height: 1 }, 2, 1);
  assert.deepEqual([...out.data], [85, 85, 85, 85, 85, 85]);
});

test("pngjs roundtrip preserves RGB vs RGBA channel count", () => {
  const rgba = image(2, 1, 4, [255, 0, 0, 0, 0, 255, 0, 255]);
  const decoded = decodePng(encodePng(rgba));
  assert.equal(decoded.channels, 4);
  assert.deepEqual([...decoded.data], [255, 0, 0, 0, 0, 255, 0, 255]);
  const rgb = image(2, 1, 3, [1, 2, 3, 4, 5, 6]);
  const decodedRgb = decodePng(encodePng(rgb));
  assert.equal(decodedRgb.channels, 3);
  assert.deepEqual([...decodedRgb.data], [1, 2, 3, 4, 5, 6]);
});

function fakeIhdr({ width, height, colorType = 6, interlace = 0 }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[12] = interlace;
  return Buffer.concat([
    PNG_SIGNATURE,
    Buffer.from([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
    ihdr,
    Buffer.alloc(4),
  ]);
}

test("admission rejects oversize IHDR before the codec allocates a raster", () => {
  assert.throws(() => decodePng(fakeIhdr({ width: MAX_DIMENSION + 1, height: 8 })), /max dimension/);
});

test("admission rejects input larger than MAX_INPUT_BYTES", () => {
  const huge = Buffer.alloc(MAX_INPUT_BYTES + 1, 0);
  PNG_SIGNATURE.copy(huge);
  assert.throws(() => decodePng(huge), /max input size/);
});

test("palette and interlaced IHDR stay out of support (no format expansion)", () => {
  assert.throws(() => decodePng(fakeIhdr({ width: 1, height: 1, colorType: 3 })), /only non-interlaced 8-bit RGB\/RGBA/);
  assert.throws(() => decodePng(fakeIhdr({ width: 1, height: 1, interlace: 1 })), /only non-interlaced 8-bit RGB\/RGBA/);
});

test("Node inflateSync without maxOutputLength can allocate more than the image (reviewer inflate case)", () => {
  const inflated = Buffer.alloc(1024 * 1024, 1);
  const compressed = deflateSync(inflated);
  const out = inflateSync(compressed);
  assert.equal(out.length, 1024 * 1024);
  assert.throws(
    () => inflateSync(compressed, { maxOutputLength: 64 }),
    (error) => error && error.code === "ERR_BUFFER_TOO_LARGE",
  );
});
