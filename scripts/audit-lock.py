#!/usr/bin/env python3
"""Audit the lockfile: flag foods missing a pin (failures) or whose resolved
description poorly matches the query (likely mis-resolved). For each flagged food,
propose a retrievable replacement (SR-Legacy-preferring, detail-endpoint 200).
Run with --write to apply the proposals."""
import json, re, subprocess, time, sys

ROOT = "/Users/xndr/Documents/coding-projects/KUfit"
KEY = open(f"{ROOT}/.fdc-key").read().strip()
LOCK = f"{ROOT}/scripts/base-foods-fdc.json"
BASE = "https://api.nal.usda.gov/fdc/v1"
WRITE = "--write" in sys.argv

def curl(args): return subprocess.run(["curl", "-s", *args], capture_output=True, text=True).stdout
def post(path, body):
    out = curl(["-X", "POST", f"{BASE}{path}?api_key={KEY}", "-H", "Content-Type: application/json", "-d", json.dumps(body)])
    return json.loads(out) if out else {}
def retrievable(fid):
    return curl(["-o", "/dev/null", "-w", "%{http_code}", f"{BASE}/food/{fid}?api_key={KEY}&format=abridged"]) == "200"

STOP = {"raw", "with", "without", "the", "and", "all", "cooked", "fresh", "added", "fluid",
        "commercial", "varieties", "includes", "prepared", "drained", "solids", "meat", "only"}
def toks(s):
    return {w for w in re.split(r"[^a-z0-9]+", (s or "").lower()) if len(w) > 2 and w not in STOP}

# Parse CONFIG [slug, name, category, query, nova, fvp] from the fetch script.
src = open(f"{ROOT}/scripts/fetch-base-foods.mjs").read()
CONFIG = re.findall(r"\['([a-z0-9-]+)', '([^']*)', '([^']*)', '((?:[^'\\]|\\.)*)', \d+, \d+\]", src)

def resolve(query):
    q = query.replace("/", " ")
    want = toks(query)
    for dt in (["SR Legacy"], ["Foundation"], ["Survey (FNDDS)"]):
        data = post("/foods/search", {"query": q, "dataType": dt, "pageSize": 25, "requireAllWords": False})
        foods = sorted(data.get("foods", []), key=lambda f: len(want & toks(f.get("description", ""))), reverse=True)
        for f in foods[:8]:
            if retrievable(f["fdcId"]):
                return f["fdcId"], f["description"], f.get("dataType")
            time.sleep(0.03)
    return None

lock = json.load(open(LOCK))
fix, review = [], []  # fix = FAIL/STALE (auto-resolve); review = WEAK (report only)
for slug, name, cat, query, *_ in CONFIG:
    query = query.replace('\\"', '"')
    pin = lock.get(slug, {})
    fid = pin.get("fdcId")
    if not fid:
        fix.append((slug, query, pin.get("description", ""), "FAIL")); continue
    if not retrievable(fid):
        fix.append((slug, query, pin.get("description", ""), "STALE(404)")); continue
    overlap = len(toks(query) & toks(pin.get("description", "")))
    if overlap < 2 and len(toks(query)) >= 2:
        review.append((slug, query, pin.get("description", ""), overlap))
    time.sleep(0.02)

print(f"== {len(fix)} to auto-fix (FAIL/STALE), {len(review)} WEAK to review, of {len(CONFIG)} ==\n")
for slug, query, desc, why in fix:
    prop = resolve(query)
    if prop:
        pfid, pdesc, dt = prop
        print(f"  {slug:18} [{why}] {desc[:36]!r} -> #{pfid} [{dt}] {pdesc}")
        if WRITE: lock[slug] = {"fdcId": pfid, "description": pdesc, "dataType": dt}
    else:
        print(f"  {slug:18} [{why}] ✗ NO retrievable match for {query!r}")
    time.sleep(0.05)

print("\n-- WEAK (manual review, not auto-applied) --")
for slug, query, desc, ov in review:
    print(f"  {slug:18} query={query[:40]!r}  pinned={desc[:45]!r}")

if WRITE:
    json.dump(lock, open(LOCK, "w"), indent=2); open(LOCK, "a").write("\n")
    print("\nApplied proposals to lockfile.")
else:
    print("\nDry-run. Re-run with --write to apply.")
