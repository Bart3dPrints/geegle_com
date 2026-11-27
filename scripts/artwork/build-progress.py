#!/usr/bin/env python3
"""Build the resumable, machine-readable artwork progress manifest.

One row per current catalog id, merged from:
  - scripts/artwork-map.json          licensed/reuse-cleared records
  - scripts/artwork/captured.json     wrapper assets and captured screens
  - scripts/artwork/review.json       human review decisions (durable)
  - scripts/artwork/blocked.json      entries with a recorded blocker

Statuses: verified | awaiting-review | rejected | blocked | not-started.
Only "verified" counts as completed coverage.

    python3 scripts/artwork/build-progress.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, "scripts", "artwork")


def load(name, default):
    try:
        with open(os.path.join(ART, name), encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def catalog():
    titles, paths, cats = {}, {}, {}
    raw = os.path.join(ROOT, "src", "data", "raw")
    exceptions = {}
    for line in open(os.path.join(raw, "path-exceptions.txt"), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "|" in line:
            key, value = line.split("|", 1)
            exceptions[key] = value
    # Same owner-authorized exclusion src/data/catalog.ts applies at runtime, so
    # this manifest counts what the library actually shows.
    excluded = {"clpolytrackbutnotflagged", "clpolytrackbutnotflagged-1"}
    order = []
    for name in sorted(os.listdir(raw)):
        if not name.endswith(".txt") or name == "path-exceptions.txt":
            continue
        for line in open(os.path.join(raw, name), encoding="utf-8"):
            parts = line.strip().split("|")
            if len(parts) < 3 or not parts[0] or parts[0].startswith("#") or parts[0] in titles or parts[0] in excluded:
                continue
            titles[parts[0]] = parts[1]
            cats[parts[0]] = parts[2]
            paths[parts[0]] = exceptions.get(parts[0], f"/games/{parts[0]}.html")
            order.append(parts[0])
    return order, titles, paths, cats


def main():
    order, titles, paths, cats = catalog()
    try:
        with open(os.path.join(ROOT, "scripts", "artwork-map.json"), encoding="utf-8") as handle:
            mapping = json.load(handle)
    except (OSError, ValueError):
        mapping = {"cleared": {}}
    captured = load("captured.json", {"assets": {}, "screens": {}}) or {"assets": {}, "screens": {}}
    review = load("review.json", {}) or {}
    blocked = load("blocked.json", {}) or {}
    audit = load("audit.json", {}) or {}
    audit_rows = {row["id"]: row for row in audit.get("rows", [])}

    records = {}
    for game_id, record in (mapping.get("cleared") or {}).items():
        records[game_id] = {**record, "tier": "cleared"}
    for bucket in ("assets", "screens"):
        for game_id, record in (captured.get(bucket) or {}).items():
            records.setdefault(game_id, {**record, "tier": bucket})

    rows = []
    for game_id in order:
        record = records.get(game_id)
        decision = review.get(game_id, {})
        status = "not-started"
        row = {
            "id": game_id,
            "title": titles[game_id],
            "categories": cats[game_id].split(","),
            "path": paths[game_id],
            "status": status,
            "method": None,
            "sourceUrl": None,
            "imagePath": None,
            "identityEvidence": None,
            "reuseEvidence": None,
            "dimensions": None,
            "sha256": None,
            "visualVerification": "not reviewed",
            "blocker": None,
        }
        if record:
            row.update(
                method=record.get("type"),
                sourceUrl=record.get("source"),
                imagePath=record.get("url"),
                identityEvidence=record.get("identityEvidence"),
                reuseEvidence=record.get("reuseEvidence"),
                sha256=record.get("assetSha256"),
            )
            info = audit_rows.get(game_id)
            if info and info.get("width"):
                row["dimensions"] = {"width": info["width"], "height": info["height"]}
            if decision.get("status") == "rejected":
                row["status"] = "rejected"
                row["blocker"] = decision.get("reason")
            elif decision.get("status") == "verified":
                row["status"] = "verified"
                row["visualVerification"] = f"verified {decision.get('reviewed')}: {decision.get('reason')}"
            else:
                row["status"] = "awaiting-review"
                if record.get("reviewStatus"):
                    row["visualVerification"] = record["reviewStatus"]
        elif game_id in blocked:
            row["status"] = "blocked"
            row["blocker"] = blocked[game_id].get("reason")
        rows.append(row)

    summary = {
        "catalogEntries": len(order),
        "verified": sum(1 for r in rows if r["status"] == "verified"),
        "awaitingReview": sum(1 for r in rows if r["status"] == "awaiting-review"),
        "rejected": sum(1 for r in rows if r["status"] == "rejected"),
        "blocked": sum(1 for r in rows if r["status"] == "blocked"),
        "notStarted": sum(1 for r in rows if r["status"] == "not-started"),
    }
    payload = {"generated": "scripts/artwork/build-progress.py", "summary": summary, "entries": rows}
    with open(os.path.join(ART, "progress.json"), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=False)
        handle.write("\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
