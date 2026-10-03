#!/usr/bin/env python3
"""Validate every scene card in src/content/scenes/.

Mirrors validateScene() in src/content/scene.schema.ts and the walk in
tests/scene.test.ts, so scenes can be checked without Node installed.
The allowed place types are parsed out of scene.schema.ts (PLACE_TYPES) so
this script cannot drift from the app.

Usage:  python scripts/check_scenes.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = os.path.join(ROOT, "src", "content", "scenes")
INDEX = os.path.join(SCENES, "index.ts")
SCHEMA = os.path.join(ROOT, "src", "content", "scene.schema.ts")
CHANNELS = {"counter", "phone"}
SENTENCE_END = re.compile(r"[.?!…][\"”]?$")


def place_types():
    """Read `export const PLACE_TYPES = [ 'a', 'b', ... ] as const` from the schema."""
    src = open(SCHEMA, encoding="utf-8").read()
    m = re.search(r"PLACE_TYPES\s*=\s*\[([^\]]*)\]", src)
    if not m:
        print("could not find PLACE_TYPES in %s" % SCHEMA, file=sys.stderr)
        sys.exit(1)
    types = set(re.findall(r"['\"]([a-z_]+)['\"]", m.group(1)))
    if not types:
        print("PLACE_TYPES in %s is empty" % SCHEMA, file=sys.stderr)
        sys.exit(1)
    return types


PLACE_TYPES = place_types()


def bi(v):
    return (
        isinstance(v, dict)
        and isinstance(v.get("en"), str)
        and v["en"].strip() != ""
        and isinstance(v.get("es"), str)
        and v["es"].strip() != ""
    )


def learner_line(p):
    """A must_use entry the learner can say: 3+ English words, sentence punctuation both sides."""
    words = [w for w in p["en"].strip().split() if w]
    return len(words) >= 3 and bool(SENTENCE_END.search(p["en"].strip())) and bool(SENTENCE_END.search(p["es"].strip()))


def norm(s):
    s = s.lower()
    s = re.sub(r"[.,;:!?¿¡…\"“”'’()]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def check(scene, errs):
    def bad(msg):
        errs.append(msg)

    if not re.fullmatch(r"[a-z0-9-]+", scene.get("id", "")):
        bad("id must be kebab-case")
    if scene.get("place_type") not in PLACE_TYPES:
        bad("place_type %r is not one of %s" % (scene.get("place_type"), sorted(PLACE_TYPES)))
    if scene.get("channel") not in CHANNELS:
        bad("channel must be one of %s" % sorted(CHANNELS))
    for k in ("title", "goal", "success", "show_staff_line", "expect"):
        if not bi(scene.get(k)):
            bad("%s needs a non-empty en and es" % k)
    staff = scene.get("show_staff_line")
    if bi(staff):
        # show_staff_line[L] is read by a speaker of L who is learning the other language.
        if "english" not in staff["en"].lower():
            bad("show_staff_line.en must say the learner is practicing English")
        if "español" not in staff["es"].lower():
            bad("show_staff_line.es must say the learner is practicing español")
    roles = scene.get("roles") or {}
    if not (bi(roles.get("partner")) and bi(roles.get("learner"))):
        bad("roles.partner and roles.learner each need en and es")
    must = scene.get("must_use")
    if not isinstance(must, list) or not 2 <= len(must) <= 3 or not all(bi(m) for m in must):
        bad("must_use needs 2 or 3 bilingual phrases")
        must = []
    for p in must:
        if not learner_line(p):
            bad('must_use "%s" must be a line the learner can say (3+ words, ends with . ? or !)' % p["en"])

    script = scene.get("offline_script") or {}
    nodes = script.get("nodes")
    if not isinstance(nodes, dict) or not isinstance(script.get("start"), str):
        bad("offline_script needs start and nodes")
        return 0
    if script["start"] not in nodes:
        bad('start node "%s" does not exist' % script["start"])
        return 0

    best_en, best_es = [], []
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
            if not isinstance(c.get("picture"), str) or not c["picture"].strip():
                bad("node %s: every choice needs a picture" % nid)
            if c.get("best"):
                best += 1
                nxt = c.get("next", False)
                if nxt is not None and nxt not in nodes:
                    bad('node %s: next "%s" does not exist' % (nid, nxt))
                if bi(c.get("text")):
                    best_en.append(norm(c["text"]["en"]))
                    best_es.append(norm(c["text"]["es"]))
            elif not bi(c.get("tip")):
                bad("node %s: non-best choice needs a bilingual tip" % nid)
        if best == 0:
            bad("node %s: needs at least one best choice" % nid)

    # Every must_use phrase has to be modeled by a best choice, in both languages.
    for p in must:
        if not any(norm(p["en"]) in t for t in best_en):
            bad('must_use "%s" is not said by any best choice (en)' % p["en"])
        if not any(norm(p["es"]) in t for t in best_es):
            bad('must_use "%s" is not said by any best choice (es)' % p["es"])

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
            print("%-30s INVALID JSON: %s" % (fn, e))
            ok = False
            continue
        steps = check(scene, errs)
        sid = scene.get("id", "?")
        if sid in ids:
            errs.append("duplicate id")
        ids.add(sid)
        if fn != sid + ".json":
            errs.append('file should be named "%s.json" to match the id' % sid)
        if ("/" + sid + ".json'") not in index_src:
            errs.append("not imported in scenes/index.ts")
        status = "OK" if not errs else "FAIL"
        print(
            "%-30s %-4s %d turns  kid=%-5s %-8s %s"
            % (fn, status, steps, bool(scene.get("kid")), scene.get("channel", "?"), scene.get("place_type", "?"))
        )
        for e in errs:
            print("    - %s" % e)
            ok = False

    kids = sum(1 for f in files if json.load(open(os.path.join(SCENES, f), encoding="utf-8")).get("kid"))
    print("\n%d scenes, %d kid scenes, %d place types allowed" % (len(files), kids, len(PLACE_TYPES)))
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
