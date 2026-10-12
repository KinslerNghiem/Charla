#!/usr/bin/env python3
"""Build public/venues.geojson from data/venues.csv.

The spreadsheet is the source of truth for the map. Every row is a place the
team verified or a public program; staff are never named. Rows without
coordinates are skipped loudly so nothing silently vanishes from the map.

Only the columns in PUBLIC_COLS and OPTIONAL_COLS reach the client. `notes`, `source` and
`verified_on` are team bookkeeping and stay in the CSV.

The output also carries a top-level "zips" object (ZIP -> [lng, lat] centroid
of the venues whose address carries that ZIP) so the ZIP box on the Places tab
can center on any ZIP that has a listed place, without a hand-typed table.

Usage:  python scripts/build_venues.py [src.csv out.geojson]
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "venues.csv")
OUT = os.path.join(ROOT, "public", "venues.geojson")

STATUSES = {"unknown", "reported", "confirmed", "listed_by_business", "listed_public"}
TYPES = {"pharmacy", "restaurant", "ice_cream", "clinic", "driver_services", "school", "grocery", "library", "college", "bank", "post_office", "transit", "park", "community"}
FORMATS = {"in_person", "online", "both"}
YES_NO = {"yes", "no", "unknown", ""}

# Everything the client may see. Anything else in the CSV is internal.
PUBLIC_COLS = (
    "id",
    "name",
    "town",
    "type",
    "scene_id",
    "address",
    "lang_es",
    "lang_en",
    "roles",
    "shifts",
    "status",
    "club_schedule",
    "meet_ok",
    "format",
)
REQUIRED_COLS = PUBLIC_COLS + ("lat", "lng", "source")
# The three free-text columns again, in Spanish, for the Spanish interface.
# Optional in the sheet so an older spreadsheet still builds; shipped as "".
OPTIONAL_COLS = ("roles_es", "shifts_es", "club_schedule_es")
SHIPPED_COLS = PUBLIC_COLS + OPTIONAL_COLS

# Rough bounding box for DuPage / Will / Kane; anything outside is a typo.
LNG_MIN, LNG_MAX = -88.6, -87.8
LAT_MIN, LAT_MAX = 41.4, 42.1

ZIP_RE = re.compile(r"\bIL\s+(\d{5})\b")


def main(src=SRC, out=OUT):
    features = []
    skipped = []
    errors = []
    seen = set()
    zip_points = {}
    with open(src, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED_COLS if c not in (reader.fieldnames or [])]
        if missing:
            print("venues.csv is missing columns: %s" % ", ".join(missing), file=sys.stderr)
            sys.exit(1)
        for n, row in enumerate(reader, start=2):
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
            if row["format"].strip() not in FORMATS:
                errors.append("line %d (%s): format must be in_person/online/both" % (n, rid))
            for col in ("lang_es", "lang_en", "meet_ok"):
                if row[col].strip().lower() not in YES_NO:
                    errors.append("line %d (%s): %s must be yes/no/unknown" % (n, rid, col))
            # Team rule: every row cites where it was checked. Checked here, never shipped.
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
            props = {k: (row.get(k) or "").strip() for k in SHIPPED_COLS}
            features.append(
                {
                    "type": "Feature",
                    "id": rid,
                    "geometry": {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]},
                    "properties": props,
                }
            )
            m = ZIP_RE.search(props["address"])
            if m:
                zip_points.setdefault(m.group(1), []).append((lng, lat))

    if errors:
        print("venues.csv has problems:", file=sys.stderr)
        for e in errors:
            print("  -", e, file=sys.stderr)
        sys.exit(1)

    features.sort(key=lambda ft: ft["id"])
    zips = {
        z: [round(sum(p[0] for p in pts) / len(pts), 5), round(sum(p[1] for p in pts) / len(pts), 5)]
        for z, pts in sorted(zip_points.items())
    }
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "zips": zips, "features": features}, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("wrote %d places to %s" % (len(features), os.path.relpath(out, ROOT)))
    if skipped:
        print("SKIPPED %d without coordinates (geocode once by hand, paste into data/venues.csv):" % len(skipped))
        for s in skipped:
            print("  -", s)
    by_status = {}
    for ft in features:
        by_status[ft["properties"]["status"]] = by_status.get(ft["properties"]["status"], 0) + 1
    print("by status:", ", ".join("%s=%d" % kv for kv in sorted(by_status.items())))
    print("zips:", ", ".join(sorted(zips)))


if __name__ == "__main__":
    if len(sys.argv) not in (1, 3):
        print("Usage: python scripts/build_venues.py [src.csv out.geojson]", file=sys.stderr)
        sys.exit(2)
    main(*sys.argv[1:])
