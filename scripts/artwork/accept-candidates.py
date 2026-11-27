#!/usr/bin/env python3
"""Validate researched icon/logo/asset candidates and add them to the runtime.

Candidates come from scripts/artwork/research-assets.mjs, which fetched each
game's own distribution pages and probed its build for declared icons, logos and
OpenGraph artwork. Every candidate is decoded, checked for real content, resized
without distortion, written as WebP and recorded with its source and method.

    python3 scripts/artwork/accept-candidates.py --staging /tmp/artcand
    python3 scripts/artwork/accept-candidates.py --staging /tmp/artcand --dry-run

Accepted records are marked awaiting-review; scripts/artwork/review.json then
records the visual decision.
"""
import argparse
import hashlib
import io
import json
import os
import sys

from PIL import Image, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
CAPTURED = os.path.join(ROOT, "scripts", "artwork", "captured.json")


def load(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def save(path, payload):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    os.replace(tmp, path)


def catalog_titles():
    titles = {}
    raw = os.path.join(ROOT, "src", "data", "raw")
    for name in sorted(os.listdir(raw)):
        if not name.endswith(".txt") or name == "path-exceptions.txt":
            continue
        for line in open(os.path.join(raw, name), encoding="utf-8"):
            parts = line.strip().split("|")
            if len(parts) >= 3 and parts[0] and parts[0] not in titles:
                titles[parts[0]] = parts[1]
    return titles


def analyse(image):
    """Reject blank, tiny, near-uniform or absurd candidates."""
    rgba = image.convert("RGBA")
    if rgba.width < 48 or rgba.height < 48:
        return None, "too-small"
    if rgba.width / rgba.height > 8 or rgba.height / rgba.width > 8:
        return None, "aspect"
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    rgb = rgba.convert("RGB")
    colors = len(rgb.getcolors(maxcolors=300000) or [])
    deviation = ImageStat.Stat(rgb.convert("L")).stddev[0]
    edges = ImageStat.Stat(rgb.convert("L").filter(ImageFilter.FIND_EDGES)).mean[0]
    if colors < 24 or (deviation < 5 and edges < 2):
        return None, "uniform"
    return rgba, None


def render(image):
    """Keep proportions: only downscale, never stretch or upscale."""
    image = image.convert("RGBA")
    if image.width > 640 or image.height > 640:
        image.thumbnail((640, 640), Image.LANCZOS)
    buffer = io.BytesIO()
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] < 250:
        image.save(buffer, "WEBP", quality=88, method=4)
    else:
        image.convert("RGB").save(buffer, "WEBP", quality=88, method=4)
    return buffer.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging", default="/tmp/artcand")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--methods", default="")
    args = parser.parse_args()

    manifest = load(os.path.join(args.staging, "manifest.json"), {})
    records = load(CAPTURED, {"assets": {}, "screens": {}})
    records.setdefault("assets", {})
    records.setdefault("screens", {})
    titles = catalog_titles()
    existing = {
        record.get("assetSha256")
        for bucket in ("assets", "screens")
        for record in records[bucket].values()
    }
    accepted = rejected = 0
    report = {"accepted": [], "rejected": []}
    for game_id, entry in sorted(manifest.items()):
        if game_id in records["assets"] or game_id in records["screens"]:
            continue
        chosen = None
        for candidate in entry.get("candidates", []):
            file = candidate.get("file")
            if not file or not os.path.exists(file):
                continue
            try:
                image = Image.open(file)
                image.load()
            except Exception:
                continue
            processed, reason = analyse(image)
            if not processed:
                report["rejected"].append({"id": game_id, "reason": reason, "url": candidate.get("url")})
                continue
            data = render(processed)
            if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                continue
            digest = hashlib.sha256(data).hexdigest()
            if digest in existing:
                report["rejected"].append({"id": game_id, "reason": "duplicate-image", "url": candidate.get("url")})
                continue
            chosen = (candidate, data, digest, image.size)
            break
        if not chosen:
            continue
        candidate, data, digest, size = chosen
        existing.add(digest)
        out = os.path.join(ARTWORK, f"{game_id}.webp")
        if not args.dry_run:
            with open(out, "wb") as handle:
                handle.write(data)
            methods = list(entry.get("methods") or [])
            records["assets"][game_id] = {
                "title": titles.get(game_id, entry.get("title", game_id)),
                "url": f"/artwork/{game_id}.webp",
                "source": candidate["url"],
                "type": candidate.get("method", "game-asset"),
                "identityEvidence": (
                    f"Published by the distribution for {titles.get(game_id, game_id)} at "
                    f"{candidate['url']}, found by fetching that distribution's own pages/assets "
                    f"({'; '.join(entry.get('methods', []))})."
                ),
                "reuseEvidence": (
                    "Artwork published by the game's own distribution for this title and used only "
                    "as its thumbnail on this platform. Rights remain with the owner and it is "
                    "removed on request."
                ),
                "assetSha256": digest,
                "methodsInvestigated": methods + ["title-screen capture (fallback)"],
                "reviewStatus": "awaiting-review",
            }
            save(CAPTURED, records)
        accepted += 1
        report["accepted"].append({"id": game_id, "url": candidate["url"], "size": size, "method": candidate.get("method")})
    save(os.path.join(args.staging, "accept-report.json"), report)
    print(json.dumps({"accepted": accepted, "rejected": rejected, "totalAssets": len(records["assets"])}))


if __name__ == "__main__":
    main()
