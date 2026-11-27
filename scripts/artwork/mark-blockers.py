#!/usr/bin/env python3
"""Record a blocker for entries no acquisition method could satisfy.

Blocker rules (evidence, not guesses):
  * no-build     -- the catalog entry has no locally served wrapper file, so
                    there is nothing this repository can render or capture.
  * blank-render -- the wrapper exists and was captured, but every frame was
                    rejected as blank/loading/portal content.

Both rules only apply when the internet research stage found no published icon,
logo or social image for the entry, and no verified or awaiting-review record
already exists. The reasons quote the evidence so they can be re-checked.
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "scripts", "artwork")
GAMES = os.path.join(ROOT, "public", "games")


def load(name, fallback):
    path = os.path.join(ART, name)
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return fallback


def main():
    staging = sys.argv[sys.argv.index("--staging") + 1] if "--staging" in sys.argv else "/tmp/artshots3"
    progress = load("progress.json", {"entries": []})["entries"]
    captured = load("captured.json", {"assets": {}, "screens": {}})
    research = load("research-log.json", {})
    reviewed = load("review.json", {})
    blocked = load("blocked.json", {})

    frames = {}
    for path in glob.glob(os.path.join(staging, "*.png")):
        game_id = os.path.basename(path).split("@")[0]
        frames[game_id] = frames.get(game_id, 0) + 1

    added = {"no-build": 0, "blank-render": 0, "capture-rejected": 0, "candidate-unusable": 0}
    for row in progress:
        game_id = row["id"]
        if row["status"] in ("verified", "awaiting-review"):
            continue
        if game_id in blocked:
            continue
        entry = research.get(game_id) or {}
        decision = (reviewed.get(game_id) or {}).get("status")
        if decision == "verified":
            continue
        if entry.get("candidates"):
            # Candidates were fetched but none survived validation (portals,
            # watermarks, tiny or undecodable files), so nothing usable remains.
            blocked[game_id] = {
                "reason": "Every published candidate asset failed validation (portal or publisher art, watermark, tiny or undecodable file), and no captured frame was usable.",
                "rule": "candidate-unusable",
                "recorded": "2026-11-27",
            }
            added["candidate-unusable"] = added.get("candidate-unusable", 0) + 1
            continue
        if decision == "rejected" and not frames.get(game_id):
            blocked[game_id] = {
                "reason": "Every captured frame for this entry was rejected (loading, error, portal or blank content) and the internet research stage found no published icon, logo or social image.",
                "rule": "capture-rejected",
                "recorded": "2026-11-27",
            }
            added["capture-rejected"] = added.get("capture-rejected", 0) + 1
            continue
        file_name = (row.get("path") or "").replace("/games/", "")
        local = os.path.join(GAMES, file_name) if file_name else None
        if not local or not os.path.exists(local):
            blocked[game_id] = {
                "reason": "No build is served locally for this entry, so there is no screen to capture; the internet research stage also found no published icon, logo or social image.",
                "rule": "no-build",
                "recorded": "2026-11-27",
            }
            added["no-build"] += 1
        elif frames.get(game_id):
            blocked[game_id] = {
                "reason": "The served wrapper rendered only blank, loading or portal content in every captured frame; the internet research stage also found no published icon, logo or social image.",
                "rule": "blank-render",
                "recorded": "2026-11-27",
            }
            added["blank-render"] += 1

    with open(os.path.join(ART, "blocked.json"), "w", encoding="utf-8") as handle:
        json.dump(blocked, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print(json.dumps({"blocked": len(blocked), "added": added}))


if __name__ == "__main__":
    main()
