#!/usr/bin/env python3
"""Write Northline Transit synthetic pixels. Not a copy of fixtures/good.

JPEG via ffmpeg on PATH. No author .tools/go. Running preflight does not
need this script once the files exist.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
COMMENT = "northline-transit-batch-c"


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
    comment: str = COMMENT,
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
    text = b"Comment\x00" + comment.encode("latin-1")
    body = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"tEXt", text)
        + png_chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + png_chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def write_master(path: Path, size: int = 256) -> None:
    """Checker so generated downscales are not a solid fill."""
    navy = (14, 86, 112, 220)
    amber = (232, 168, 64, 255)
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            cell = (x // 16 + y // 16) % 2
            pixel = navy if cell == 0 else amber
            rows.extend(pixel)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    text = b"Comment\x00" + COMMENT.encode("latin-1")
    body = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"tEXt", text)
        + png_chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + png_chunk(b"IEND", b"")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)


def write_jpeg(path: Path, width: int, height: int, rgb: tuple[int, int, int]) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not on PATH; needed to write JPEG without author .tools/go")
    path.parent.mkdir(parents=True, exist_ok=True)
    color = f"0x{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c={color}:s={width}x{height}:d=0.04",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        str(path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    data = path.read_bytes()
    if data[:3] != b"\xff\xd8\xff":
        raise RuntimeError(f"did not write JPEG bytes to {path}")


def reset_dir(path: Path) -> Path:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    return path


def write_app_tiles(root: Path, *, include_tile_120: bool) -> None:
    write_png(root / "tile-20.png", 20, 20, alpha=True, rgb=(14, 86, 112), alpha_value=220)
    write_png(root / "tile-40.png", 40, 40, alpha=True, rgb=(14, 86, 112), alpha_value=220)
    write_png(root / "tile-80.png", 80, 80, alpha=True, rgb=(14, 86, 112), alpha_value=220)
    write_png(root / "lockup.png", 180, 36, alpha=False, rgb=(6, 22, 44))
    if include_tile_120:
        write_png(root / "tile-120.png", 120, 120, alpha=True, rgb=(14, 86, 112), alpha_value=220)


def write_boards(root: Path, *, wide_height: int) -> None:
    write_png(root / "board-square.png", 90, 90, alpha=False, rgb=(228, 148, 52))
    write_jpeg(root / "board-wide.jpg", 180, wide_height, (18, 52, 92))
    write_png(root / "board-tall.png", 60, 180, alpha=False, rgb=(52, 132, 100))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def existing_repo_hashes() -> dict[str, str]:
    hashes: dict[str, str] = {}
    for path in REPO.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        if "reports/batch-c" in path.as_posix():
            continue
        rel = path.relative_to(REPO).as_posix()
        hashes[rel] = sha256_file(path)
    return hashes


def overlap_report(new_files: list[Path], old: dict[str, str]) -> dict:
    old_by_hash: dict[str, list[str]] = {}
    for rel, digest in old.items():
        old_by_hash.setdefault(digest, []).append(rel)
    collisions = []
    rows = []
    for path in new_files:
        digest = sha256_file(path)
        rows.append({"path": path.as_posix(), "sha256": digest, "bytes": path.stat().st_size})
        hits = old_by_hash.get(digest, [])
        if hits:
            collisions.append({"new": path.as_posix(), "sha256": digest, "old": hits})
    return {
        "newFiles": len(rows),
        "oldImageFilesHashed": len(old),
        "sha256Overlap": len(collisions),
        "collisions": collisions,
        "files": rows,
    }


def main() -> int:
    write_master(HERE / "source" / "tile-master-256.png")

    first = reset_dir(HERE / "delivery")
    write_app_tiles(first / "app-tiles", include_tile_120=False)
    write_boards(first / "station-boards", wide_height=64)

    fixed = reset_dir(HERE / "delivery-fixed")
    write_app_tiles(fixed / "app-tiles", include_tile_120=False)
    write_boards(fixed / "station-boards", wide_height=60)

    v2 = reset_dir(HERE / "delivery-v2")
    write_app_tiles(v2 / "app-tiles", include_tile_120=True)
    write_boards(v2 / "station-boards", wide_height=60)

    new_files = sorted(
        p
        for p in HERE.rglob("*")
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg"}
    )
    report = overlap_report(new_files, existing_repo_hashes())
    out = HERE.parent / "observations" / "uniqueness.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {first}")
    print(f"wrote {fixed} (board-wide.jpg 180x60)")
    print(f"wrote {v2} (includes tile-120.png)")
    print(f"wrote {HERE / 'source' / 'tile-master-256.png'}")
    print(f"sha256 overlap with other repo images: {report['sha256Overlap']} / {report['newFiles']} new files")
    if report["sha256Overlap"] != 0:
        print(json.dumps(report["collisions"], indent=2), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
