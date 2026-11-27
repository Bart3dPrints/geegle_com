#!/usr/bin/env python3
"""Render labelled contact sheets for visual artwork review.

    python3 scripts/artwork/contact-sheet.py --ids-from audit.json --out /tmp/sheet-1.jpg
    python3 scripts/artwork/contact-sheet.py --ids clhobo,clslope --out /tmp/sheet-2.jpg

Each cell is a 320x180 thumbnail with the catalog title and id underneath, so a
reviewer can spot wrong, blank, duplicated or loading-screen images.
"""
import argparse
import glob
import json
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
CELL_W, CELL_H = 320, 180
LABEL_H = 34
COLUMNS = 5


def font(size=13):
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size)
            except OSError:
                continue
    return ImageFont.load_default()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", default="")
    parser.add_argument("--ids-from", default="")
    parser.add_argument("--glob", default="")
    parser.add_argument("--out", default="/tmp/contact-sheet.jpg")
    parser.add_argument("--columns", type=int, default=COLUMNS)
    parser.add_argument("--titles", default=os.path.join(ROOT, "scripts", "artwork", "titles.json"))
    args = parser.parse_args()

    titles = {}
    if os.path.exists(args.titles):
        titles = json.load(open(args.titles, encoding="utf-8"))

    if args.ids:
        ids = [v.strip() for v in args.ids.split(",") if v.strip()]
    elif args.ids_from:
        payload = json.load(open(args.ids_from, encoding="utf-8"))
        ids = [row["id"] for row in payload.get("rows", payload.get("accepted", []))]
    elif args.glob:
        ids = sorted(os.path.basename(p).split(".")[0] for p in glob.glob(args.glob))
    else:
        ids = sorted(os.path.basename(p).split(".")[0] for p in glob.glob(os.path.join(ARTWORK, "*.webp")))

    ids = [i for i in ids if os.path.exists(os.path.join(ARTWORK, f"{i}.webp"))]
    if not ids:
        raise SystemExit("no artwork for the requested ids")
    rows = (len(ids) + args.columns - 1) // args.columns
    sheet = Image.new("RGB", (CELL_W * args.columns, (CELL_H + LABEL_H) * rows), (24, 24, 27))
    draw = ImageDraw.Draw(sheet)
    label_font = font(13)
    for index, game_id in enumerate(ids):
        column, row = index % args.columns, index // args.columns
        x, y = column * CELL_W, row * (CELL_H + LABEL_H)
        image = Image.open(os.path.join(ARTWORK, f"{game_id}.webp")).convert("RGB")
        image.thumbnail((CELL_W, CELL_H))
        sheet.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
        draw.rectangle([x, y + CELL_H, x + CELL_W - 1, y + CELL_H + LABEL_H - 1], fill=(32, 32, 36))
        draw.text((x + 5, y + CELL_H + 2), (titles.get(game_id) or game_id)[:38], fill=(240, 240, 240), font=label_font)
        draw.text((x + 5, y + CELL_H + 18), f"{index + 1}. {game_id}"[:44], fill=(150, 150, 160), font=label_font)
    sheet.save(args.out, "JPEG", quality=88)
    print(json.dumps({"out": args.out, "images": len(ids), "size": sheet.size}))


if __name__ == "__main__":
    main()
