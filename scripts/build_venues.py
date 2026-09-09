#!/usr/bin/env python3
"""Build public/venues.geojson from data/venues.csv.

The spreadsheet is the source of truth for the map. Every row is a place the
team verified or a public program; staff are never named. Rows without
coordinates are skipped loudly so nothing silently vanishes from the map.

Usage:  python scripts/build_venues.py
"""
import csv
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "venues.csv")
OUT = os.path.join(ROOT, "public", "venues.geojson")

STATUSES = {"unknown", "reported", "confirmed", "listed_by_business", "listed_public"}
TYPES = {"pharmacy", "restaurant", "clinic", "driver_services", "school", "grocery", "library", "college"}
YES_NO = {"yes", "no", "unknown", ""}

# Rough bounding box for DuPage / Will / Kane; anything outside is a typo.
LNG_MIN, LNG_MAX = -88.6, -87.8
LAT_MIN, LAT_MAX = 41.4, 42.1


def main():
    features = []
    skipped = []
    errors = []
    seen = set()
    with open(SRC, newline="", encoding="utf-8") as f:
        for n, row in enumerate(csv.DictReader(f), start=2):
            rid = row["id"].strip()
            if not rid:
                errors.append("line %d: empty id" % n)
                continue
            if rid in seen:
                errors.append("line %d: duplicate id %s" % (n, rid))
                continue
            seen.add(rid)
            if row["status"] not in STATUSES:
                errors.append("line %d (%s): bad status %r" % (n, rid, row["status"]))
            if row["type"] not in TYPES:
                errors.append("line %d (%s): bad type %r" % (n, rid, row["type"]))
            for col in ("lang_es", "lang_en", "meet_ok"):
                if row[col].strip().lower() not in YES_NO:
                    errors.append("line %d (%s): %s must be yes/no/unknown" % (n, rid, col))
            if not row["source"].strip():
                errors.append("line %d (%s): source is required" % (n, rid))
            lat, lng = row["lat"].strip(), row["lng"].strip()
            if not lat or not lng:
                skipped.append(rid)
                continue
            try:
                lat, lng = float(lat), float(lng)
            except ValueError:
                errors.append("line %d (%s): lat/lng not numbers" % (n, rid))
                continue
            if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
                errors.append("line %d (%s): coordinates outside the area" % (n, rid))
                continue
            props = {k: (v or "").strip() for k, v in row.items() if k not in ("lat", "lng")}
            features.append(
                {
                    "type": "Feature",
                    "id": rid,
                    "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                    "properties": props,
                }
            )

    if errors:
        print("venues.csv has problems:", file=sys.stderr)
        for e in errors:
            print("  -", e, file=sys.stderr)
        sys.exit(1)

    features.sort(key=lambda ft: ft["id"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("wrote %d places to %s" % (len(features), os.path.relpath(OUT, ROOT)))
    if skipped:
        print("SKIPPED %d without coordinates (geocode once by hand, paste into data/venues.csv):" % len(skipped))
        for s in skipped:
            print("  -", s)
    by_status = {}
    for ft in features:
        by_status[ft["properties"]["status"]] = by_status.get(ft["properties"]["status"], 0) + 1
    print("by status:", ", ".join("%s=%d" % kv for kv in sorted(by_status.items())))


if __name__ == "__main__":
    main()
