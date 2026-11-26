#!/usr/bin/env python3
"""Build per-game artwork from evidence, not guesswork.

Two passes, in the mission's priority order:

  --assets    Download artwork a game wrapper declares for itself (og:image,
              icon links, logo files) and optimise it to /artwork/<id>.webp.
  --screens   For games with no such asset, launch the actual game in Chromium,
              dismiss the loading screen and capture its title screen or
              gameplay. Blank, uniform and error pages are rejected.

Every accepted image is recorded in scripts/artwork/captured.json with its
identity evidence, source and SHA-256. Progress is appended after each game so
an interrupted run resumes without repeating work.

    /tmp/venv/bin/python scripts/artwork/capture.py --assets
    /tmp/venv/bin/python scripts/artwork/capture.py --screens --limit 200
"""
import argparse
import re
import asyncio
import hashlib
import io
import json
import os
import sys
import urllib.parse
import urllib.request

from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTWORK = os.path.join(ROOT, "public", "artwork")
CAPTURED = os.path.join(ROOT, "scripts", "artwork", "captured.json")
CANDIDATES = os.path.join(ROOT, "scripts", "artwork", "candidates.json")
BASE = os.environ.get("GEEGLE_BASE", "http://127.0.0.1:3000")
REPO = "https://github.com/Bart3dPrints/geegle_com/blob/main"

os.makedirs(ARTWORK, exist_ok=True)

# Asset URLs and file names must stay safe slugs; a catalog row with a space in
# its id would otherwise create a record the manifest generator rejects.
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]+$")


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


RECORDS = load_json(CAPTURED, {"assets": {}, "screens": {}})
RECORDS.setdefault("assets", {})
RECORDS.setdefault("screens", {})


def save_records():
    payload = json.dumps(RECORDS, indent=2, sort_keys=True)
    with open(CAPTURED + ".tmp", "w", encoding="utf-8") as handle:
        handle.write(payload)
    os.replace(CAPTURED + ".tmp", CAPTURED)


def optimize(raw, out_path):
    """Decode, verify the image is real, and store a 16:9 webp thumbnail."""
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception:
        return None
    if image.width < 64 or image.height < 64:
        return None
    if image.width / image.height > 6 or image.height / image.width > 6:
        return None
    image = image.convert("RGB")
    # Centre-crop to 16:9 so every card has the same shape.
    target = 16 / 9
    ratio = image.width / image.height
    if ratio > target:
        width = int(image.height * target)
        left = (image.width - width) // 2
        image = image.crop((left, 0, left + width, image.height))
    else:
        height = int(image.width / target)
        top = (image.height - height) // 2
        image = image.crop((0, top, image.width, top + height))
    image = image.resize((640, 360), Image.LANCZOS)
    image.save(out_path, "WEBP", quality=82, method=4)
    with open(out_path, "rb") as handle:
        data = handle.read()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    return hashlib.sha256(data).hexdigest()


def informativeness(image):
    """Reject blank, uniform and loading-screen captures."""
    grey = image.convert("L")
    deviation = ImageStat.Stat(grey).stddev[0]
    colors = len(image.convert("RGB").getcolors(maxcolors=200000) or [])
    return {"stddev": round(deviation, 2), "colors": colors, "usable": deviation > 6 or colors > 900}


def fetch(url, timeout=20):
    request = urllib.request.Request(url, headers={"User-Agent": "GeegleArtwork/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            return None
        data = response.read(8 * 1024 * 1024)
        ctype = response.headers.get("content-type", "")
        if ctype and not (ctype.startswith("image/") or "octet-stream" in ctype):
            return None
        return data


def cleared_ids():
    """Ids that already have a licensed image; never download over them."""
    mapping = load_json(os.path.join(ROOT, "scripts", "artwork-map.json"), {"cleared": {}})
    return set((mapping.get("cleared") or {}).keys())


def run_assets():
    candidates = load_json(CANDIDATES, {"candidates": {}})["candidates"]
    licensed = cleared_ids()
    accepted = skipped = 0
    for game_id, entry in candidates.items():
        if not SAFE_ID.match(game_id):
            continue
        if game_id in licensed or game_id in RECORDS["assets"] or game_id in RECORDS["screens"]:
            continue
        for candidate in entry["candidates"]:
            url = candidate.get("remote")
            if not url:
                continue
            # A wrapper can declare its own splash/presplash; that is a loading
            # screen, not the title's artwork.
            if re.search(r"presplash|loading|splash|placeholder", url, re.I):
                continue
            try:
                raw = fetch(url)
            except Exception:
                continue
            if not raw:
                continue
            out = os.path.join(ARTWORK, f"{game_id}.webp")
            digest = optimize(raw, out)
            if not digest:
                continue
            RECORDS["assets"][game_id] = {
                "title": entry.get("title", game_id),
                "url": f"/artwork/{game_id}.webp",
                "source": url,
                "type": candidate.get("kind", "game-asset"),
                "identityEvidence": (
                    f"The wrapper this repository distributes for {entry.get('title', game_id)} "
                    f"declares this image as its own artwork ({candidate.get('kind')})."
                ),
                "reuseEvidence": (
                    "Artwork published by the game's own distribution for this title and referenced "
                    "by the copy this repository serves; shown only on the same platform. Rights "
                    "remain with the game's owner and it is removed on request."
                ),
                "assetSha256": digest,
            }
            accepted += 1
            save_records()
            break
        else:
            skipped += 1
    print(json.dumps({"accepted": accepted, "skipped": skipped, "totalAssets": len(RECORDS["assets"])}))


def catalog_games():
    sys.path.insert(0, os.path.dirname(CAPTURED))
    games = []
    for name in sorted(os.listdir(os.path.join(ROOT, "src", "data", "raw"))):
        if not name.endswith(".txt") or name == "path-exceptions.txt":
            continue
        with open(os.path.join(ROOT, "src", "data", "raw", name), encoding="utf-8") as handle:
            for line in handle:
                parts = line.strip().split("|")
                if len(parts) >= 3 and parts[0] and parts[1] and parts[2]:
                    games.append({"id": parts[0], "title": parts[1]})
    exceptions = {}
    with open(os.path.join(ROOT, "src", "data", "raw", "path-exceptions.txt"), encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if "|" in line and not line.startswith("#"):
                key, value = line.split("|", 1)
                exceptions[key] = value
    seen = set()
    unique = []
    for game in games:
        if game["id"] in seen:
            continue
        seen.add(game["id"])
        game["path"] = exceptions.get(game["id"], f"/games/{urllib.parse.quote(game['id'])}.html")
        unique.append(game)
    return unique


async def run_screens(limit, delay):
    from playwright.async_api import async_playwright

    games = catalog_games()
    licensed = cleared_ids()
    todo = [
        game for game in games
        if SAFE_ID.match(game["id"])
        and game["path"].startswith("/games/")
        and game["id"] not in licensed
        and game["id"] not in RECORDS["assets"]
        and game["id"] not in RECORDS["screens"]
    ]
    if limit:
        todo = todo[:limit]
    print(f"[screens] {len(todo)} to capture", flush=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        context = await browser.new_context(viewport={"width": 1024, "height": 576})
        context.set_default_timeout(15000)
        accepted = rejected = 0
        for index, game in enumerate(todo, 1):
            page = await context.new_page()
            try:
                await page.goto(BASE + game["path"], wait_until="load", timeout=15000)
            except Exception:
                rejected += 1
                await page.close()
                continue
            try:
                # Let engines boot (Unity/Ruffle fetch large payloads).
                # Engines boot slowly and often show a "PLAY"/engine splash
                # first, so dismiss it and give the real title screen time.
                await page.wait_for_timeout(6000)
                for _ in range(2):
                    try:
                        await page.mouse.click(512, 300)
                    except Exception:
                        pass
                    await page.wait_for_timeout(2000)
                raw = await page.screenshot(type="png")
            except Exception:
                rejected += 1
                await page.close()
                continue
            await page.close()

            image = Image.open(io.BytesIO(raw)).convert("RGB")
            info = informativeness(image)
            colours = len(image.getcolors(maxcolors=200000) or [])
            if colours < 64:
                info["usable"] = False
            if not info["usable"]:
                rejected += 1
                continue
            out = os.path.join(ARTWORK, f"{game['id']}.webp")
            digest = optimize(raw, out)
            if not digest:
                rejected += 1
                continue
            # A digest already recorded for another game is a shared splash or
            # loading screen, not this title's artwork: drop it.
            seen = {
                record.get("assetSha256")
                for bucket in ("assets", "screens")
                for record in RECORDS[bucket].values()
            }
            if digest in seen:
                os.remove(out)
                rejected += 1
                continue
            RECORDS["screens"][game["id"]] = {
                "title": game["title"],
                "url": f"/artwork/{game['id']}.webp",
                "source": f"{REPO}/public/games/{urllib.parse.quote(os.path.basename(game['path']))}",
                "type": "gameplay-screenshot",
                "identityEvidence": (
                    f"Captured from the {game['title']} wrapper this repository serves at "
                    f"{game['path']} after it initialised in Chromium."
                ),
                "reuseEvidence": (
                    "Screenshot of the game as distributed by this platform, used only as its "
                    "thumbnail on the same platform. Game imagery remains the property of its "
                    "owner and is removed on request."
                ),
                "assetSha256": digest,
                "signal": info,
            }
            accepted += 1
            if accepted % 10 == 0:
                save_records()
                print(f"[screens] {index}/{len(todo)} accepted={accepted} rejected={rejected}", flush=True)
            await asyncio.sleep(delay)
        save_records()
        await browser.close()
    print(json.dumps({"captured": accepted, "rejected": rejected, "totalScreens": len(RECORDS["screens"])}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", action="store_true")
    parser.add_argument("--screens", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--delay", type=float, default=0.1)
    args = parser.parse_args()
    if args.assets:
        run_assets()
    if args.screens:
        asyncio.run(run_screens(args.limit, args.delay))


if __name__ == "__main__":
    main()
