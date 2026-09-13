#!/usr/bin/env python3
"""Write new M4 handoff-task pixels. Not a copy of fixtures/good.

Go is only needed to regenerate the JPEG bytes. Running preflight does not
need this script.
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
WORKSPACE = PROJECT.parents[1]
GO_BIN = WORKSPACE / ".tools" / "go" / "bin" / "go"
WRITE_JPEG = WORKSPACE / "drafts" / "channel-cover-preflight" / "scripts" / "write-jpeg.go"

KIOSK = HERE / "tasks" / "kiosk-badge"
DOCS = HERE / "tasks" / "docs-social"


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(
    path: Path,
    width: int,
    height: int,
    *,
    alpha: bool,
    rgb: tuple[int, int, int],
    alpha_value: int = 255,
) -> None:
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


def reset_dir(path: Path) -> Path:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    return path


def write_kiosk(delivery: Path) -> None:
    badge = reset_dir(delivery / "badge")
    posters = reset_dir(delivery / "posters")
    write_png(badge / "badge-24.png", 24, 24, alpha=True, rgb=(8, 140, 132), alpha_value=210)
    write_png(badge / "badge-48.png", 48, 48, alpha=True, rgb=(8, 140, 132), alpha_value=210)
    write_png(badge / "badge-96.png", 96, 96, alpha=True, rgb=(8, 140, 132), alpha_value=210)
    write_png(badge / "plate.png", 200, 80, alpha=False, rgb=(18, 28, 38))
    write_png(posters / "poster-square.png", 80, 80, alpha=False, rgb=(220, 80, 60))
    write_jpeg(posters / "poster-wide.jpg", 192, 108, (20, 40, 90))
    write_png(posters / "poster-tall.png", 108, 192, alpha=False, rgb=(240, 180, 40))


def write_docs(delivery: Path, *, wide_height: int) -> None:
    favicons = reset_dir(delivery / "favicons")
    social = reset_dir(delivery / "social")
    write_png(favicons / "favicon-32.png", 32, 32, alpha=True, rgb=(90, 40, 160), alpha_value=200)
    write_png(favicons / "favicon-64.png", 64, 64, alpha=True, rgb=(90, 40, 160), alpha_value=200)
    write_png(social / "card-square.png", 72, 72, alpha=False, rgb=(40, 20, 80))
    write_jpeg(social / "card-wide.jpg", 176, wide_height, (200, 170, 40))
    write_png(social / "card-tall.png", 99, 176, alpha=False, rgb=(30, 110, 90))


def main() -> int:
    if not WRITE_JPEG.is_file():
        print(f"missing JPEG helper: {WRITE_JPEG}", file=sys.stderr)
        return 2
    write_kiosk(KIOSK / "delivery")
    write_docs(DOCS / "delivery", wide_height=100)
    write_docs(DOCS / "delivery-fixed", wide_height=99)
    print(f"wrote {KIOSK / 'delivery'}")
    print(f"wrote {DOCS / 'delivery'} (card-wide.jpg is 176x100, on purpose)")
    print(f"wrote {DOCS / 'delivery-fixed'} (card-wide.jpg is 176x99)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
