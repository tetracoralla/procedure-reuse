#!/usr/bin/env python3
"""Generate legal PNG/JPEG bytes for channel-cover preflight fixtures.

Nested covers/ layout, mixed PNG+JPEG, aspect-ratio family.
Not a copy of the icon-suite generator.
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
WORKSPACE = ROOT.parents[1]
GO_BIN = WORKSPACE / ".tools" / "go" / "bin" / "go"
WRITE_JPEG = ROOT / "scripts" / "write-jpeg.go"


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


def write_jpeg(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    go = GO_BIN if GO_BIN.is_file() else Path(shutil.which("go") or "go")
    path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(go),
        "run",
        str(WRITE_JPEG),
        "-o",
        str(path),
        "-w",
        str(width),
        "-h",
        str(height),
        "-r",
        str(rgb[0]),
        "-g",
        str(rgb[1]),
        "-b",
        str(rgb[2]),
    ]
    subprocess.run(cmd, check=True)
    data = path.read_bytes()
    if data[:3] != b"\xff\xd8\xff":
        raise RuntimeError(f"did not write JPEG bytes to {path}")


def copy_tree_files(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def write_delivery(dir_path: Path, *, square: tuple[int, int, int], landscape: tuple[int, int, int], portrait: tuple[int, int, int]) -> None:
    if dir_path.exists():
        shutil.rmtree(dir_path)
    covers = dir_path / "covers"
    covers.mkdir(parents=True)
    write_png(covers / "cover-1x1.png", 64, 64, alpha=False, rgb=square)
    write_jpeg(covers / "cover-16x9.jpg", 160, 90, landscape)
    write_png(covers / "cover-9x16.png", 90, 160, alpha=False, rgb=portrait)


def main() -> int:
    good = FIXTURES / "good"
    alt = FIXTURES / "good-alt"
    write_delivery(good, square=(40, 80, 160), landscape=(200, 120, 40), portrait=(20, 140, 90))
    write_delivery(alt, square=(160, 40, 80), landscape=(40, 40, 200), portrait=(180, 90, 20))

    bad = FIXTURES / "bad"
    if bad.exists():
        shutil.rmtree(bad)

    copy_tree_files(good, bad / "wrong-size")
    write_jpeg(bad / "wrong-size" / "covers" / "cover-16x9.jpg", 160, 80, (200, 120, 40))

    copy_tree_files(good, bad / "wrong-aspect")
    write_jpeg(bad / "wrong-aspect" / "covers" / "cover-16x9.jpg", 160, 100, (200, 120, 40))

    copy_tree_files(good, bad / "wrong-format")
    write_png(bad / "wrong-format" / "covers" / "cover-16x9.jpg", 160, 90, alpha=False, rgb=(200, 120, 40))

    copy_tree_files(good, bad / "transparent")
    write_png(bad / "transparent" / "covers" / "cover-1x1.png", 64, 64, alpha=True, rgb=(40, 80, 160), alpha_value=180)

    copy_tree_files(good, bad / "missing-slot")
    (bad / "missing-slot" / "covers" / "cover-9x16.png").unlink()

    copy_tree_files(good, bad / "extra-file")
    write_png(bad / "extra-file" / "covers" / "scratch-cover.png", 64, 64, alpha=False, rgb=(90, 90, 90))

    copy_tree_files(good, bad / "wrong-name")
    (bad / "wrong-name" / "covers" / "cover-1x1.png").replace(bad / "wrong-name" / "covers" / "cover_1x1.png")

    empty = FIXTURES / "empty"
    empty.mkdir(parents=True, exist_ok=True)

    print(f"wrote fixtures under {FIXTURES}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
