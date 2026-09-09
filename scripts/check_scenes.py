#!/usr/bin/env python3
"""Validate every scene card in src/content/scenes/.

Mirrors validateScene() in src/content/scene.schema.ts and the walk in
tests/scene.test.ts, so scenes can be checked without Node installed.

Usage:  python scripts/check_scenes.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = os.path.join(ROOT, "src", "content", "scenes")
INDEX = os.path.join(SCENES, "index.ts")
PLACE_TYPES = {"pharmacy", "restaurant", "clinic", "driver_services", "school", "grocery", "library", "college"}


def bi(v):
    return (
        isinstance(v, dict)
        and isinstance(v.get("en"), str)
        and v["en"].strip() != ""
        and isinstance(v.get("es"), str)
        and v["es"].strip() != ""
    )


def check(scene, errs):
    def bad(msg):
        errs.append(msg)

    if not re.fullmatch(r"[a-z0-9-]+", scene.get("id", "")):
        bad("id must be kebab-case")
    if scene.get("place_type") not in PLACE_TYPES:
        bad("place_type %r is not one of %s" % (scene.get("place_type"), sorted(PLACE_TYPES)))
    for k in ("title", "goal", "success", "show_staff_line"):
        if not bi(scene.get(k)):
            bad("%s needs a non-empty en and es" % k)
    roles = scene.get("roles") or {}
    if not (bi(roles.get("partner")) and bi(roles.get("learner"))):
        bad("roles.partner and roles.learner each need en and es")
    must = scene.get("must_use")
    if not isinstance(must, list) or len(must) < 2 or not all(bi(m) for m in must):
        bad("must_use needs at least 2 bilingual phrases")

    script = scene.get("offline_script") or {}
    nodes = script.get("nodes")
    if not isinstance(nodes, dict) or not isinstance(script.get("start"), str):
        bad("offline_script needs start and nodes")
        return 0
    if script["start"] not in nodes:
        bad('start node "%s" does not exist' % script["start"])
        return 0

    kid = bool(scene.get("kid"))
    for nid, node in nodes.items():
        if not bi(node.get("partner")):
            bad("node %s: partner needs en and es" % nid)
        choices = node.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            bad("node %s: needs at least 2 choices" % nid)
            continue
        best = 0
        for c in choices:
            if not bi(c.get("text")):
                bad("node %s: choice text needs en and es" % nid)
            if c.get("best"):
                best += 1
                nxt = c.get("next", False)
                if nxt is not None and nxt not in nodes:
                    bad('node %s: next "%s" does not exist' % (nid, nxt))
            elif not bi(c.get("tip")):
                bad("node %s: non-best choice needs a bilingual tip" % nid)
            if kid and not c.get("picture"):
                bad("node %s: kid scenes need a picture on every choice" % nid)
        if best == 0:
            bad("node %s: needs at least one best choice" % nid)

    # Walk the best path; it must terminate and be worth playing.
    node_id, steps = script["start"], 0
    while node_id:
        best = [c for c in nodes[node_id]["choices"] if c.get("best")]
        if not best:
            bad("node %s: no best choice to walk" % node_id)
            break
        node_id = best[0].get("next")
        steps += 1
        if steps > 50:
            bad("offline_script loops")
            break
    if steps < 3:
        bad("offline_script is only %d turns; aim for 3 to 8" % steps)
    return steps


def main():
    ok = True
    ids = set()
    files = sorted(f for f in os.listdir(SCENES) if f.endswith(".json"))
    if not files:
        print("no scenes found in %s" % SCENES, file=sys.stderr)
        sys.exit(1)

    index_src = open(INDEX, encoding="utf-8").read() if os.path.exists(INDEX) else ""

    for fn in files:
        path = os.path.join(SCENES, fn)
        errs = []
        try:
            scene = json.load(open(path, encoding="utf-8"))
        except ValueError as e:
            print("%-26s INVALID JSON: %s" % (fn, e))
            ok = False
            continue
        steps = check(scene, errs)
        sid = scene.get("id", "?")
        if sid in ids:
            errs.append("duplicate id")
        ids.add(sid)
        if fn != sid + ".json":
            errs.append('file should be named "%s.json" to match the id' % sid)
        if ('/' + sid + "'") not in index_src and (sid + ".json") not in index_src:
            errs.append("not imported in scenes/index.ts")
        status = "OK" if not errs else "FAIL"
        print("%-26s %-4s %d turns  kid=%-5s %s" % (fn, status, steps, bool(scene.get("kid")), scene.get("place_type", "?")))
        for e in errs:
            print("    - %s" % e)
            ok = False

    print("\n%d scenes, %d kid scenes" % (len(files), sum(1 for f in files if json.load(open(os.path.join(SCENES, f), encoding="utf-8")).get("kid"))))
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
