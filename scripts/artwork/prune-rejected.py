#!/usr/bin/env python3
"""Remove rejected artwork from the runtime records and delete its files.

scripts/artwork/review.json is the durable review decision log. A record marked
"rejected" must not be displayed, so it is dropped from captured.json and its
local WebP is deleted. Cleared (license-backed) records are never touched here.

    python3 scripts/artwork/prune-rejected.py --dry-run
    python3 scripts/artwork/prune-rejected.py
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAPTURED = os.path.join(ROOT, "scripts", "artwork", "captured.json")
REVIEW = os.path.join(ROOT, "scripts", "artwork", "review.json")


def load(path, default):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    review = load(REVIEW, {})
    records = load(CAPTURED, {"assets": {}, "screens": {}})
    removed = []
    for bucket in ("assets", "screens"):
        for game_id in list((records.get(bucket) or {}).keys()):
            decision = review.get(game_id, {})
            if decision.get("status") != "rejected":
                continue
            record = records[bucket].pop(game_id)
            removed.append({"id": game_id, "bucket": bucket, "url": record.get("url")})
            url = record.get("url") or ""
            local = os.path.join(ROOT, "public", url.lstrip("/"))
            if not args.dry_run and os.path.exists(local):
                os.remove(local)
    if not args.dry_run:
        with open(CAPTURED + ".tmp", "w", encoding="utf-8") as handle:
            json.dump(records, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(CAPTURED + ".tmp", CAPTURED)
    print(json.dumps({"removed": len(removed), "items": removed}, indent=1))


if __name__ == "__main__":
    main()
