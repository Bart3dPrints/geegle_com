#!/usr/bin/env python3
"""Validate captured frames and turn the best one into card artwork.

Frames come from scripts/artwork/capture-screens.mjs. Each frame is scored on
content coverage, colour variety, contrast and edge density. Blank, uniform and
loading-bar frames are rejected; the earliest high-quality frame is chosen so a
title screen beats later gameplay where both are usable.

The chosen frame is cropped to the actual game area (the surrounding letterbox
is removed) and padded to 16:9 on the game's own background colour, then written
to public/artwork/<id>.webp and recorded in scripts/artwork/captured.json.

    python3 scripts/artwork/process-shots.py --staging /tmp/artshots
    python3 scripts/artwork/process-shots.py --staging /tmp/artshots --dry-run
"""
import argparse
import glob
import hashlib
import time
import io
import json
import os
import sys

from PIL import Image, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
CAPTURED = os.path.join(ROOT, "scripts", "artwork", "captured.json")
REPO = "https://github.com/Bart3dPrints/geegle_com/blob/main"


def catalog_titles():
    """id -> exact catalog title, so records never carry an id as a title."""
    titles = {}
    raw = os.path.join(ROOT, "src", "data", "raw")
    for name in sorted(os.listdir(raw)):
        if not name.endswith(".txt") or name == "path-exceptions.txt":
            continue
        with open(os.path.join(raw, name), encoding="utf-8") as handle:
            for line in handle:
                parts = line.strip().split("|")
                if len(parts) >= 3 and parts[0] and parts[0] not in titles:
                    titles[parts[0]] = parts[1]
    return titles


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def save_json(path, payload):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    os.replace(tmp, path)


def background(image):
    """Most common colour along the frame border."""
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = []
    for x in range(0, width, 4):
        pixels.append(rgb.getpixel((x, 0)))
        pixels.append(rgb.getpixel((x, height - 1)))
    for y in range(0, height, 4):
        pixels.append(rgb.getpixel((0, y)))
        pixels.append(rgb.getpixel((width - 1, y)))
    counts = {}
    for pixel in pixels:
        counts[pixel] = counts.get(pixel, 0) + 1
    return max(counts.items(), key=lambda item: item[1])[0]


def content_box(image, bg, tolerance=14):
    """Bounding box of pixels that differ from the letterbox colour."""
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    src = image.load()
    dst = mask.load()
    step = 2
    for y in range(0, height, step):
        for x in range(0, width, step):
            pixel = src[x, y]
            if abs(pixel[0] - bg[0]) + abs(pixel[1] - bg[1]) + abs(pixel[2] - bg[2]) > tolerance * 3:
                dst[x, y] = 255
    bbox = mask.getbbox()
    if not bbox:
        return None
    # Snap to the sampling grid and add a small margin.
    left, top, right, bottom = bbox
    return (max(0, left - 2), max(0, top - 2), min(width, right + 2), min(height, bottom + 2))


def analyse(image):
    bg = background(image)
    box = content_box(image, bg)
    if not box:
        return {"usable": False, "reason": "blank", "bg": bg, "box": None}
    # Ignore boxes that cover essentially nothing.
    area = (box[2] - box[0]) * (box[3] - box[1])
    coverage = area / float(image.width * image.height)
    content = image.crop(box).convert("RGB")
    grey = content.convert("L")
    deviation = ImageStat.Stat(grey).stddev[0]
    colors = len(content.getcolors(maxcolors=300000) or [])
    edges = ImageStat.Stat(content.filter(ImageFilter.FIND_EDGES).convert("L")).mean[0]
    # A loading bar or an engine splash is a flat field with almost no detail.
    flat_run = max((count for count, _ in (content.getcolors(maxcolors=300000) or [(0, 0)])), default=0)
    dominant = flat_run / float(content.width * content.height)
    # A portal "play" splash is a white field with a large orange circle. It
    # passes generic detail checks, so detect it explicitly.
    rgb_pixels = content.resize((128, 72)).getdata()
    total = 128 * 72.0
    white = sum(1 for p in rgb_pixels if p[0] > 235 and p[1] > 235 and p[2] > 235)
    orange = sum(1 for p in rgb_pixels if p[0] > 200 and 55 < p[1] < 170 and p[2] < 110)
    play_splash = coverage < 0.35 and white / total > 0.5 and 0.02 < orange / total < 0.3
    usable = (
        coverage >= 0.008
        and content.width >= 64
        and content.height >= 48
        and colors >= 32
        and deviation >= 8
        and edges >= 2.5
        and dominant <= 0.95
        and not play_splash
    )
    # A flat orange "PLAY" splash has huge dominant coverage and weak edges.
    score = (coverage ** 0.5) * (min(colors, 60000) ** 0.25) * (deviation ** 0.5) * (edges ** 0.6) * (1.0 - dominant)
    return {
        "usable": usable,
        "reason": None if usable else "low-information",
        "bg": bg,
        "box": box,
        "coverage": round(coverage, 3),
        "colors": colors,
        "stddev": round(deviation, 2),
        "edges": round(edges, 2),
        "dominant": round(dominant, 3),
        "score": round(score, 2),
    }


def render(image, info):
    """Crop to the game area, pad to 16:9 on its own background, resize 640x360."""
    bg = tuple(info["bg"])
    content = image.crop(info["box"]).convert("RGB")
    target = 16 / 9
    ratio = content.width / content.height
    if ratio > target:
        height = int(round(content.width / target))
        canvas = Image.new("RGB", (content.width, height), bg)
        canvas.paste(content, (0, (height - content.height) // 2))
    else:
        width = int(round(content.height * target))
        canvas = Image.new("RGB", (width, content.height), bg)
        canvas.paste(content, ((width - content.width) // 2, 0))
    # Downscale large captures, but never upscale small pixel-art windows: a
    # stretched thumbnail is worse than a smaller, sharp one.
    if canvas.width > 640 or canvas.height > 360:
        canvas.thumbnail((640, 360), Image.LANCZOS)
    buffer = io.BytesIO()
    canvas.save(buffer, "WEBP", quality=82, method=4)
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", default="/tmp/artshots")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overrides", default=os.path.join(ROOT, "scripts", "artwork", "frame-overrides.json"))
    parser.add_argument("--min-frames", type=int, default=3)
    parser.add_argument("--settle", type=int, default=30, help="skip ids whose newest frame is younger than N seconds")
    args = parser.parse_args()

    titles = catalog_titles()
    research = load_json(os.path.join(ROOT, "scripts", "artwork", "research-log.json"), {})
    decisions = load_json(os.path.join(ROOT, "scripts", "artwork", "review.json"), {})
    records = load_json(CAPTURED, {"assets": {}, "screens": {}})
    records.setdefault("assets", {})
    records.setdefault("screens", {})
    overrides = load_json(args.overrides, {})
    known_hashes = {
        record.get("assetSha256")
        for bucket in ("assets", "screens")
        for record in records[bucket].values()
    }

    grouped = {}
    for file in sorted(glob.glob(os.path.join(args.staging, "*.png"))):
        name = os.path.basename(file)
        game_id = name.split("@")[0]
        grouped.setdefault(game_id, []).append(file)

    accepted, rejected = 0, 0
    report = {"accepted": [], "rejected": []}
    now = time.time()
    for game_id, files in sorted(grouped.items()):
        if game_id in records["screens"] or game_id in records["assets"]:
            continue
        if (decisions.get(game_id) or {}).get("status") == "rejected":
            continue
        if len(files) < args.min_frames:
            continue
        if now - max(os.path.getmtime(file) for file in files) < args.settle:
            continue
        analysed = []
        for file in files:
            try:
                image = Image.open(file)
                image.load()
            except Exception:
                continue
            if image.width < 320 or image.height < 180:
                continue
            info = analyse(image)
            analysed.append((file, image, info))
        usable = [item for item in analysed if item[2]["usable"]]
        if not usable:
            rejected += 1
            report["rejected"].append({"id": game_id, "reason": "no usable frame", "frames": [i[2].get("reason") for i in analysed]})
            continue
        forced = overrides.get(game_id)
        if forced:
            chosen = next((item for item in analysed if item[0].endswith(f"@{forced}.png")), None)
            if not chosen:
                chosen = max(usable, key=lambda item: item[2]["score"])
        else:
            best = max(item[2]["score"] for item in usable)
            # Prefer the earliest frame close to the best so a title screen wins.
            chosen = next(item for item in usable if item[2]["score"] >= best * 0.8)
        file, image, info = chosen
        data = render(image, info)
        if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            rejected += 1
            report["rejected"].append({"id": game_id, "reason": "encode-failed"})
            continue
        digest = hashlib.sha256(data).hexdigest()
        if digest in known_hashes:
            rejected += 1
            report["rejected"].append({"id": game_id, "reason": "shared-frame"})
            continue
        known_hashes.add(digest)
        out = os.path.join(ARTWORK, f"{game_id}.webp")
        if not args.dry_run:
            with open(out, "wb") as handle:
                handle.write(data)
            records["screens"][game_id] = {
                "title": titles.get(game_id, game_id),
                "url": f"/artwork/{game_id}.webp",
                "source": f"{REPO}/public/games/{game_id}.html",
                "type": "gameplay-screenshot",
                "identityEvidence": (
                    f"Captured from the actual game this repository serves at /games/{game_id}.html "
                    f"after it rendered its own screen in Chromium."
                ),
                "reuseEvidence": (
                    "Screenshot of the game as distributed by this platform, used only as its thumbnail "
                    "on the same platform. Game imagery remains the property of its owner and is removed "
                    "on request."
                ),
                "assetSha256": digest,
                "signal": {key: info[key] for key in ("coverage", "colors", "stddev", "edges", "dominant")},
                "frame": os.path.basename(file),
                "methodsInvestigated": (research.get(game_id, {}).get("methods") or [])
                + ["title-screen capture (last resort)"],
                "reviewStatus": "awaiting-review",
            }
            save_json(CAPTURED, records)
        accepted += 1
        report["accepted"].append({"id": game_id, "frame": os.path.basename(file), "hash": digest, "signal": info})
    save_json(os.path.join(args.staging, "process-report.json"), report)
    print(json.dumps({"accepted": accepted, "rejected": rejected, "totalScreens": len(records["screens"])}))


if __name__ == "__main__":
    main()
