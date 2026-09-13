#!/usr/bin/env python3
"""Naive campaign checker for the same Northline Transit acceptance.

Reads the batch campaign JSON and kit specs. Uses PNG IHDR and ffprobe.
This is the short-script alternative, not File Vitals and not the combinator.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path


def reduced_ratio(width: int, height: int) -> str:
    g = math.gcd(width, height)
    return f"{width // g}:{height // g}"


def png_ihdr(path: Path) -> dict:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return {"format": "not-png", "signature": data[:8].hex()}
    length = struct.unpack(">I", data[8:12])[0]
    tag = data[12:16]
    if tag != b"IHDR" or length < 13:
        return {"format": "png-malformed"}
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    alpha = "present" if color_type == 6 else "absent" if color_type == 2 else f"colorType-{color_type}"
    return {
        "format": "png",
        "width": width,
        "height": height,
        "bitDepth": bit_depth,
        "colorType": color_type,
        "alpha": alpha,
    }


def jpeg_probe(path: Path) -> dict:
    data = path.read_bytes()
    if data[:3] != b"\xff\xd8\xff":
        return {"format": "not-jpeg", "signature": data[:8].hex()}
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return {"format": "jpeg", "width": None, "height": None, "alpha": "absent", "note": "no-ffprobe"}
    proc = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    stream = json.loads(proc.stdout)["streams"][0]
    return {
        "format": "jpeg" if stream.get("codec_name") in {"mjpeg", "jpeg"} else stream.get("codec_name"),
        "width": stream.get("width"),
        "height": stream.get("height"),
        "alpha": "absent",
    }


def list_files(root: Path) -> list[str]:
    files = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            files.append(path.relative_to(root).as_posix())
    return files


def check_asset_delivery(spec: dict, root: Path) -> list[dict]:
    checks = []
    present = set(list_files(root))
    declared = {slot["path"] for slot in spec["slots"]}
    for slot in spec["slots"]:
        path = root / slot["path"]
        label = {"kitKind": "asset-delivery", "slot": slot["id"], "path": slot["path"]}
        if slot["path"] not in present:
            checks.append({**label, "id": "missing", "passed": False, "expected": slot["path"], "observed": None})
            continue
        obs = png_ihdr(path) if slot["format"] == "png" else jpeg_probe(path)
        checks.append({**label, "id": "name", "passed": path.name == slot.get("name", slot["path"]), "expected": slot.get("name"), "observed": path.name})
        checks.append({**label, "id": "format", "passed": obs.get("format") == slot["format"], "expected": slot["format"], "observed": obs.get("format")})
        checks.append({**label, "id": "width", "passed": obs.get("width") == slot["width"], "expected": slot["width"], "observed": obs.get("width")})
        checks.append({**label, "id": "height", "passed": obs.get("height") == slot["height"], "expected": slot["height"], "observed": obs.get("height")})
        if slot["alpha"] in {"present", "absent"}:
            checks.append({**label, "id": "alpha", "passed": obs.get("alpha") == slot["alpha"], "expected": slot["alpha"], "observed": obs.get("alpha")})
    extras = sorted(present - declared)
    if extras:
        checks.append({"kitKind": "asset-delivery", "id": "extra", "passed": False, "expected": [], "observed": extras})
    else:
        checks.append({"kitKind": "asset-delivery", "id": "extra", "passed": True, "expected": [], "observed": []})
    return checks


def check_channel_cover(spec: dict, root: Path) -> list[dict]:
    checks = []
    present = set(list_files(root))
    declared = {slot["path"] for slot in spec["slots"] if slot.get("required", True)}
    optional = {slot["path"] for slot in spec["slots"] if not slot.get("required", True)}
    pattern = re.compile(spec["naming"]["pattern"])
    for slot in spec["slots"]:
        path = root / slot["path"]
        label = {"kitKind": "channel-cover", "slot": slot["id"], "path": slot["path"]}
        if slot["path"] not in present:
            if slot.get("required", True):
                checks.append({**label, "id": "missing", "passed": False, "expected": slot["path"], "observed": None})
            continue
        obs = png_ihdr(path) if slot["format"] == "png" else jpeg_probe(path)
        checks.append({**label, "id": "namePattern", "passed": bool(pattern.match(path.name)), "expected": spec["naming"]["pattern"], "observed": path.name})
        checks.append({**label, "id": "format", "passed": obs.get("format") == slot["format"], "expected": slot["format"], "observed": obs.get("format")})
        checks.append({**label, "id": "width", "passed": obs.get("width") == slot["width"], "expected": slot["width"], "observed": obs.get("width")})
        checks.append({**label, "id": "height", "passed": obs.get("height") == slot["height"], "expected": slot["height"], "observed": obs.get("height")})
        observed_aspect = reduced_ratio(obs["width"], obs["height"]) if obs.get("width") and obs.get("height") else None
        checks.append({**label, "id": "aspect", "passed": observed_aspect == slot["aspect"], "expected": slot["aspect"], "observed": observed_aspect})
        if not spec.get("transparencyAllowed", True):
            # IHDR color type only. JPEG assumed opaque. Not File Vitals has_alpha.
            passed = obs.get("alpha") == "absent"
            checks.append({**label, "id": "transparency", "passed": passed, "expected": "absent", "observed": obs.get("alpha")})
    extras = sorted(present - declared - optional)
    checks.append({"kitKind": "channel-cover", "id": "extra", "passed": extras == [], "expected": [], "observed": extras})
    return checks


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    spec_path = Path(args.spec).resolve()
    root = Path(args.root).resolve()
    campaign = json.loads(spec_path.read_text(encoding="utf-8"))
    all_checks = []
    failed_kits = []
    for kit in campaign["kits"]:
        kit_root = root / kit["root"]
        kit_spec = json.loads((spec_path.parent / kit["specPath"]).read_text(encoding="utf-8"))
        if not kit_root.is_dir():
            all_checks.append({"kit": kit["id"], "id": "kitMissing", "passed": False})
            failed_kits.append(kit["id"])
            continue
        if kit["kind"] == "asset-delivery":
            checks = check_asset_delivery(kit_spec, kit_root)
        elif kit["kind"] == "channel-cover":
            checks = check_channel_cover(kit_spec, kit_root)
        else:
            print(f"unsupported kind {kit['kind']}", file=sys.stderr)
            return 2
        for check in checks:
            check["kit"] = kit["id"]
        all_checks.extend(checks)
        if any(not item["passed"] for item in checks):
            failed_kits.append(kit["id"])
    failed_ids = sorted({item["id"] for item in all_checks if not item["passed"]})
    status = "pass" if not failed_kits else "fail"
    report = {
        "status": status,
        "summary": {"failedKits": failed_kits, "failedIds": failed_ids},
        "checks": all_checks,
        "note": "naive PNG-IHDR + ffprobe checker; not File Vitals; not the combinator",
    }
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0 if status == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
