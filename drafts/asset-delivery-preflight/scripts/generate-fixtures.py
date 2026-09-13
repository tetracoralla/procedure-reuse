#!/usr/bin/env python3
"""Generate legal PNG/JPEG/ICO/WebP bytes for the asset-delivery preflight fixtures.

Does not invent file types by extension. Every PNG is a real PNG bitstream.
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures"
SAMPLES = ROOT / "observations" / "samples"

# Real 1x1 VP8L WebP from file-vitals regression tests: dimensions known, has_alpha omitted.
VP8L_WEBP = bytes(
    [
        0x52,
        0x49,
        0x46,
        0x46,
        28,
        0,
        0,
        0,
        0x57,
        0x45,
        0x42,
        0x50,
        0x56,
        0x50,
        0x38,
        0x4C,
        15,
        0,
        0,
        0,
        0x2F,
        0,
        0,
        0,
        0,
        0x07,
        0x10,
        0xF5,
        0x8F,
        0xFE,
        0x07,
        0x22,
        0xA2,
        0xFF,
        0x01,
        0,
    ]
)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, width: int, height: int, *, alpha: bool, rgb: tuple[int, int, int], alpha_value: int = 255) -> None:
    color_type = 6 if alpha else 2
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            r, g, b = rgb
            # Transparent corner on alpha images so the channel is not a dummy fill.
            a = 0 if alpha and x == 0 and y == 0 else (alpha_value if alpha else 255)
            rows.extend((r, g, b, a) if alpha else (r, g, b))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, color_type, 0, 0, 0)
    body = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + png_chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def write_jpeg_via_ffmpeg(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    # ffmpeg infers the muxer from the output suffix, so write a real .jpg first,
    # then copy those JPEG bytes onto the delivery filename (which may be .png).
    raw = bytes(rgb) * (width * height)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.stem}.jpg")
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{width}x{height}",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-q:v",
        "4",
        str(tmp),
    ]
    subprocess.run(cmd, input=raw, check=True)
    data = tmp.read_bytes()
    tmp.unlink()
    if data[:3] != b"\xff\xd8\xff":
        raise RuntimeError(f"ffmpeg did not write JPEG bytes to {tmp}")
    path.write_bytes(data)


def write_ico_with_png(path: Path, png_bytes: bytes, width: int, height: int) -> None:
    # ICONDIR + one ICONDIRENTRY pointing at an embedded PNG. File Vitals has no ICO signature.
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        width if width < 256 else 0,
        height if height < 256 else 0,
        0,
        0,
        1,
        32,
        len(png_bytes),
        6 + 16,
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + entry + png_bytes)


def copy_tree_files(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    dst.mkdir(parents=True)
    for item in src.iterdir():
        if item.is_file():
            shutil.copy2(item, dst / item.name)


def write_delivery(dir_path: Path, *, icon_rgb: tuple[int, int, int], mark_rgb: tuple[int, int, int], cover_rgb: tuple[int, int, int]) -> None:
    if dir_path.exists():
        shutil.rmtree(dir_path)
    dir_path.mkdir(parents=True)
    write_png(dir_path / "icon-16.png", 16, 16, alpha=True, rgb=icon_rgb, alpha_value=220)
    write_png(dir_path / "icon-32.png", 32, 32, alpha=True, rgb=icon_rgb, alpha_value=220)
    write_png(dir_path / "icon-64.png", 64, 64, alpha=True, rgb=icon_rgb, alpha_value=220)
    write_png(dir_path / "icon-128.png", 128, 128, alpha=True, rgb=icon_rgb, alpha_value=220)
    write_png(dir_path / "wordmark.png", 320, 64, alpha=False, rgb=mark_rgb)
    write_png(dir_path / "og-cover.png", 640, 360, alpha=False, rgb=cover_rgb)


def main() -> int:
    if shutil.which("ffmpeg") is None:
        print("ffmpeg is required to write the JPEG format-mismatch fixture", file=sys.stderr)
        return 2

    good = FIXTURES / "good"
    alt = FIXTURES / "good-alt"
    write_delivery(good, icon_rgb=(30, 90, 200), mark_rgb=(24, 24, 24), cover_rgb=(236, 240, 245))
    write_delivery(alt, icon_rgb=(200, 80, 30), mark_rgb=(48, 32, 16), cover_rgb=(250, 236, 220))

    bad = FIXTURES / "bad"
    if bad.exists():
        shutil.rmtree(bad)

    copy_tree_files(good, bad / "wrong-size")
    write_png(bad / "wrong-size" / "icon-64.png", 48, 48, alpha=True, rgb=(30, 90, 200), alpha_value=220)

    copy_tree_files(good, bad / "wrong-format")
    write_jpeg_via_ffmpeg(bad / "wrong-format" / "wordmark.png", 320, 64, (24, 24, 24))
    jpeg_named_png = (bad / "wrong-format" / "wordmark.png").read_bytes()
    if jpeg_named_png[:3] != b"\xff\xd8\xff":
        raise RuntimeError("wrong-format/wordmark.png is not JPEG bytes")

    copy_tree_files(good, bad / "wrong-alpha")
    write_png(bad / "wrong-alpha" / "wordmark.png", 320, 64, alpha=True, rgb=(24, 24, 24), alpha_value=180)

    copy_tree_files(good, bad / "missing-slot")
    (bad / "missing-slot" / "icon-128.png").unlink()

    copy_tree_files(good, bad / "extra-file")
    write_png(bad / "extra-file" / "scratch-icon.png", 16, 16, alpha=True, rgb=(90, 90, 90), alpha_value=220)

    copy_tree_files(good, bad / "wrong-name")
    (bad / "wrong-name" / "icon-16.png").replace(bad / "wrong-name" / "icon16.png")

    if SAMPLES.exists():
        shutil.rmtree(SAMPLES)
    SAMPLES.mkdir(parents=True)
    shutil.copy2(good / "icon-16.png", SAMPLES / "icon-16.png")
    write_ico_with_png(SAMPLES / "icon.ico", (good / "icon-16.png").read_bytes(), 16, 16)
    (SAMPLES / "vp8l-unknown-alpha.webp").write_bytes(VP8L_WEBP)

    print(f"wrote fixtures under {FIXTURES}")
    print(f"wrote observation samples under {SAMPLES}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
