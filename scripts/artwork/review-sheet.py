#!/usr/bin/env python3
"""Build contact sheets from search-images.mjs candidates for visual review.

One row per game, up to three candidate thumbnails per row (the first three
image results the owner asked us to inspect), labelled with the catalog id and
the candidate number.

    python3 scripts/artwork/review-sheet.py --index /tmp/isearch/index.json --out /tmp/isheets
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

CELL_W, CELL_H = 320, 180
LABEL_H = 22
COLS = 3
ROWS_PER_SHEET = 6


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="/tmp/isearch/index.json")
    ap.add_argument("--out", default="/tmp/isheets")
    ap.add_argument("--rows", type=int, default=ROWS_PER_SHEET)
    args = ap.parse_args()

    index = load(args.index)
    base = os.path.dirname(os.path.abspath(args.index))
    os.makedirs(args.out, exist_ok=True)

    items = [(k, v) for k, v in index.items() if v.get("candidates")]
    sheet = 0
    for start in range(0, len(items), args.rows):
        chunk = items[start:start + args.rows]
        height = len(chunk) * (CELL_H + LABEL_H) + 26
        sheet += 1
        img = Image.new("RGB", (COLS * CELL_W + 20, height), (18, 18, 22))
        draw = ImageDraw.Draw(img)
        draw.text((8, 6), f"batch {sheet}  rows {start + 1}-{start + len(chunk)}", fill=(220, 220, 230))
        y = 26
        for gid, rec in chunk:
            draw.text((8, y), f"{gid}  |  {rec['title']}", fill=(255, 230, 120))
            for i, cand in enumerate(rec["candidates"][:COLS]):
                path = os.path.join(base, cand["file"])
                x = i * CELL_W + 10
                try:
                    with Image.open(path) as src:
                        src = src.convert("RGB")
                        src.thumbnail((CELL_W - 8, CELL_H - 8))
                        img.paste(src, (x + (CELL_W - src.width) // 2, y + LABEL_H + (CELL_H - src.height) // 2))
                except Exception as exc:  # noqa: BLE001 - a broken download must not stop the sheet
                    draw.text((x + 6, y + LABEL_H + 60), f"unreadable: {exc}", fill=(200, 90, 90))
                draw.text((x + 4, y + LABEL_H + 2), str(i + 1), fill=(120, 255, 160))
            y += CELL_H + LABEL_H
        out = os.path.join(args.out, f"sheet{sheet:02d}.jpg")
        img.save(out, quality=82)
        print(out)


if __name__ == "__main__":
    main()
