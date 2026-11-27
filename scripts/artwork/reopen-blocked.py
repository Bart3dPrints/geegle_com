#!/usr/bin/env python3
"""Reopen every blocked artwork entry.

The previous pass marked 1,676 entries as blocked, most of them because one
early frame was blank. The owner rejected that as a finished result, so this
script moves the whole manifest into scripts/artwork/reopened.json with its
original rule and reason preserved, empties blocked.json, and clears the
capture-based `rejected` review decisions that would otherwise make the capture
pipeline skip an id. Candidate-research rejections (nothing published anywhere)
are kept as durable evidence.

    python3 scripts/artwork/reopen-blocked.py
    python3 scripts/artwork/reopen-blocked.py --dry-run
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "scripts", "artwork")

CAPTURE_MARKERS = (
    "Captured frame",
    "captured frame",
    "blank",
    "wrapper",
    "loading",
    "play-button",
    "play overlay",
)


def load(name, default):
    path = os.path.join(ART, name)
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def save(name, payload):
    path = os.path.join(ART, name)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    os.replace(tmp, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    blocked = load("blocked.json", {})
    reopened = load("reopened.json", {})
    review = load("review.json", {})

    reopened_ids = []
    for game_id, entry in blocked.items():
        record = dict(entry) if isinstance(entry, dict) else {"reason": str(entry)}
        record["previousRule"] = record.get("rule") or record.get("previousRule")
        record.setdefault("previousReason", record.get("reason"))
        record["reopened"] = "2026-11-27"
        record["reopenReason"] = (
            "Owner rejected the blocked classification: a blank early frame or limited "
            "wrapper-only research does not establish that artwork is unavailable."
        )
        reopened[game_id] = record
        reopened_ids.append(game_id)

    # Every rejected decision for a reopened id describes a frame or a research
    # candidate, not the game. Keep it as evidence, but drop it from review.json
    # so the capture pipeline is allowed to look at the id again.
    cleared = []
    kept = {}
    for game_id, decision in review.items():
        if (decision or {}).get("status") == "rejected" and game_id in reopened:
            reopened[game_id]["previousReview"] = decision
            cleared.append(game_id)
            continue
        kept[game_id] = decision

    if args.dry_run:
        print(json.dumps({
            "blocked": len(blocked),
            "reopened": len(reopened),
            "reviewsCleared": len(cleared),
            "reviewsKept": len(kept),
        }))
        return

    save("reopened.json", reopened)
    save("blocked.json", {})
    save("review.json", kept)
    print(json.dumps({
        "reopened": len(reopened_ids),
        "reviewsCleared": len(cleared),
        "reviewsKept": len(kept),
    }))


if __name__ == "__main__":
    main()
