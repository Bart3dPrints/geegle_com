#!/usr/bin/env python3
"""Audit every artwork record: decode, dimensions, hashes, uniformity, similarity.

Automated checks supplement visual review; they never replace it.

    python3 scripts/artwork/audit-artwork.py
    python3 scripts/artwork/audit-artwork.py --ids clhobo,clslope

Writes scripts/artwork/audit.json with one row per referenced stable id.
"""
import argparse
import hashlib
import json
import os
import sys

from PIL import Image, ImageFilter, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
OUT = os.path.join(ROOT, "scripts", "artwork", "audit.json")


def load(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def catalog():
    titles = {}
    paths = {}
    raw = os.path.join(ROOT, "src", "data", "raw")
    exceptions = {}
    for line in open(os.path.join(raw, "path-exceptions.txt"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "|" in line:
            key, value = line.split("|", 1)
            exceptions[key] = value
    for name in sorted(os.listdir(raw)):
        if not name.endswith(".txt") or name == "path-exceptions.txt":
            continue
        for line in open(os.path.join(raw, name), encoding="utf-8"):
            parts = line.strip().split("|")
            if len(parts) >= 3 and parts[0] and parts[0] not in titles:
                titles[parts[0]] = parts[1]
                paths[parts[0]] = exceptions.get(parts[0], f"/games/{parts[0]}.html")
    return titles, paths


def fingerprint(image):
    """64-bit difference hash: robust to resizing and mild compression."""
    small = image.convert("L").resize((9, 8), Image.LANCZOS)
    pixels = list(small.getdata())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (1 if pixels[row * 9 + col] > pixels[row * 9 + col + 1] else 0)
    return f"{bits:016x}"


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", default="")
    args = parser.parse_args()
    only = {v.strip() for v in args.ids.split(",") if v.strip()}

    mapping = load(os.path.join(ROOT, "scripts", "artwork-map.json"), {"cleared": {}})
    captured = load(os.path.join(ROOT, "scripts", "artwork", "captured.json"), {"assets": {}, "screens": {}})
    records = {}
    for game_id, record in (mapping.get("cleared") or {}).items():
        records[game_id] = {"tier": "cleared", **record}
    for bucket in ("assets", "screens"):
        for game_id, record in (captured.get(bucket) or {}).items():
            if game_id in records:
                continue
            records[game_id] = {"tier": bucket, **record}

    titles, _ = catalog()
    rows = []
    hashes = {}
    prints = {}
    for game_id, record in sorted(records.items()):
        if only and game_id not in only:
            continue
        url = record.get("url", "")
        local = os.path.join(ROOT, "public", url.lstrip("/"))
        row = {
            "id": game_id,
            "title": titles.get(game_id, record.get("title")),
            "tier": record["tier"],
            "url": url,
            "recordedTitle": record.get("title"),
            "source": record.get("source"),
            "type": record.get("type"),
            "problems": [],
        }
        try:
            with open(local, "rb") as handle:
                data = handle.read()
            image = Image.open(local)
            image.load()
        except Exception as error:
            row["problems"].append(f"undecodable: {type(error).__name__}")
            row["status"] = "broken"
            rows.append(row)
            continue
        digest = hashlib.sha256(data).hexdigest()
        row["bytes"] = len(data)
        row["width"], row["height"] = image.size
        row["sha256"] = digest
        row["phash"] = fingerprint(image)
        row["format"] = image.format
        rgb = image.convert("RGB")
        row["colors"] = len(rgb.getcolors(maxcolors=300000) or [])
        row["stddev"] = round(ImageStat.Stat(rgb.convert("L")).stddev[0], 2)
        row["edges"] = round(ImageStat.Stat(rgb.convert("L").filter(ImageFilter.FIND_EDGES)).mean[0], 2)
        if record.get("assetSha256") and digest != record["assetSha256"]:
            row["problems"].append("hash-mismatch")
        if row["width"] < 160 or row["height"] < 90:
            row["problems"].append("small")
        if row["colors"] < 16 or row["stddev"] < 3:
            row["problems"].append("uniform")
        if row["recordedTitle"] and row["recordedTitle"] != row["title"]:
            row["problems"].append(f"title-mismatch: recorded {row['recordedTitle']!r}")
        hashes.setdefault(digest, []).append(game_id)
        prints.setdefault(row["phash"], []).append(game_id)
        row["status"] = "ok" if not row["problems"] else "review"
        rows.append(row)

    duplicates = {digest: ids for digest, ids in hashes.items() if len(ids) > 1}
    similar = {p: ids for p, ids in prints.items() if len(ids) > 1}
    for row in rows:
        if row.get("sha256") in duplicates:
            row["problems"].append("exact-duplicate:" + ",".join(duplicates[row["sha256"]]))
        if row.get("phash") in similar:
            row["problems"].append("near-duplicate:" + ",".join(similar[row["phash"]]))
            if row["status"] == "ok":
                row["status"] = "review"

    payload = {
        "generated": "scripts/artwork/audit-artwork.py",
        "summary": {
            "records": len(rows),
            "ok": sum(1 for r in rows if r["status"] == "ok"),
            "review": sum(1 for r in rows if r["status"] == "review"),
            "broken": sum(1 for r in rows if r["status"] == "broken"),
            "exactDuplicateGroups": len(duplicates),
            "nearDuplicateGroups": len(similar),
        },
        "rows": rows,
    }
    with open(OUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(json.dumps(payload["summary"]))
    for row in rows:
        if row["problems"]:
            print(row["id"], row["title"], "|", "; ".join(row["problems"]))


if __name__ == "__main__":
    main()
