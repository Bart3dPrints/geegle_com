#!/usr/bin/env python3
"""Turn reviewed search candidates into card artwork.

Reads a selections file (id -> candidate number + review note) produced after
looking at the contact sheets, then for each id writes a 16:9 WebP thumbnail to
public/artwork/<id>.webp and records the source page, the search query and the
review note in scripts/artwork/captured.json and review.json.

Wide images are centre-cropped; tall images (box art, app icons, cartridge
scans) are shown whole over a blurred copy of themselves so the title stays
readable instead of being cropped away.

    python3 scripts/artwork/apply-search-art.py --index /tmp/isearch/index.json \\
        --selections /tmp/isearch/selections.json
"""
import argparse
import hashlib
import json
import os

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
CAPTURED = os.path.join(ROOT, "scripts", "artwork", "captured.json")
REVIEW = os.path.join(ROOT, "scripts", "artwork", "review.json")
W, H = 640, 360

REUSE = (
    "Artwork of this title obtained through an independent internet image search and shown only as "
    "its thumbnail on this platform; no license is claimed. Rights remain with the game's owner and "
    "the image is removed on request."
)


def fit(img):
    img = img.convert("RGB")
    ratio = img.width / img.height
    if 1.55 <= ratio <= 1.95:
        scale = max(W / img.width, H / img.height)
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
        left = (img.width - W) // 2
        top = (img.height - H) // 2
        return img.crop((left, top, left + W, top + H))
    # Blurred cover behind a contained copy keeps tall artwork legible.
    scale = max(W / img.width, H / img.height)
    back = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (back.width - W) // 2
    top = (back.height - H) // 2
    back = back.crop((left, top, left + W, top + H)).filter(ImageFilter.GaussianBlur(14))
    inner = img.copy()
    inner.thumbnail((W, H), Image.LANCZOS)
    back.paste(inner, ((W - inner.width) // 2, (H - inner.height) // 2))
    return back


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="/tmp/isearch/index.json")
    ap.add_argument("--selections", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    base = os.path.dirname(os.path.abspath(args.index))
    index = json.load(open(args.index, encoding="utf-8"))
    selections = json.load(open(args.selections, encoding="utf-8"))
    captured = json.load(open(CAPTURED, encoding="utf-8"))
    review = json.load(open(REVIEW, encoding="utf-8"))

    applied = 0
    for game_id, pick in selections.items():
        rec = index.get(game_id)
        if not rec or not rec.get("candidates"):
            print(f"skip {game_id}: no candidates")
            continue
        n = int(pick["pick"]) - 1
        cands = rec["candidates"]
        if n >= len(cands):
            print(f"skip {game_id}: candidate {n + 1} missing")
            continue
        cand = cands[n]
        src = os.path.join(base, cand["file"])
        with Image.open(src) as raw:
            out = fit(raw)
        target = os.path.join(ARTWORK, f"{game_id}.webp")
        if args.dry_run:
            print(f"would write {target} from {cand['imageUrl']}")
            continue
        out.save(target, "WEBP", quality=84, method=6)
        blob = open(target, "rb").read()
        captured["screens"][game_id] = {
            "assetSha256": hashlib.sha256(blob).hexdigest(),
            "collectionMethod": "internet-image-search",
            "identityEvidence": (
                f"Found by searching \"{rec['query']}\" in Bing Images and taking result {n + 1}; "
                f"the image was checked against the catalog title \"{rec['title']}\" before use. "
                f"Source page: {cand['pageUrl'] or cand['imageUrl']}"
            ),
            "reuseEvidence": REUSE,
            "reviewStatus": "verified",
            "searchQuery": rec["query"],
            "source": cand["pageUrl"] or cand["imageUrl"],
            "title": rec["title"],
            "type": "game-asset",
            "url": f"/artwork/{game_id}.webp",
        }
        review[game_id] = {
            "reason": pick["note"],
            "reviewed": "2026-11-27",
            "status": "verified",
            "title": rec["title"],
        }
        applied += 1

    if args.dry_run:
        return
    json.dump(captured, open(CAPTURED, "w", encoding="utf-8"), indent=2)
    open(CAPTURED, "a", encoding="utf-8").write("\n")
    json.dump(review, open(REVIEW, "w", encoding="utf-8"), indent=2, sort_keys=True)
    open(REVIEW, "a", encoding="utf-8").write("\n")
    print(f"applied {applied} artworks")


if __name__ == "__main__":
    main()
