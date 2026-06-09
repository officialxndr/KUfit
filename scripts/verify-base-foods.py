#!/usr/bin/env python3
"""
Verify assets/foods/base-ingredients.json against the USDA FoodData Central
*Foundation Foods* bulk download (docs/FoodData_Central_foundation_food_json_*.json).

The Foundation set is mostly RAW whole foods. Most base foods were generated from
SR-Legacy *cooked/canned* records, which are NOT in this download — so this file
can only verify a subset. We use a hand-curated slug -> fdcId map (high confidence)
and bucket everything else as "not in this Foundation file".
"""
import json, glob

ROOT = "/Users/xndr/Documents/coding-projects/KUfit"
BASE = f"{ROOT}/assets/foods/base-ingredients.json"
FDC = sorted(glob.glob(f"{ROOT}/docs/FoodData_Central_foundation_food_json_*.json"))[-1]

ENERGY = [1008, 2048, 2047]
MACROS = {"protein": [1003], "fat": [1004], "carbs": [1005],
          "fiber": [1079], "sugar": [2000, 1063], "satFat": [1258]}
SODIUM = 1093

# Hand-curated, high-confidence map: base slug -> Foundation fdcId (raw/equivalent).
# None = genuinely NOT in this Foundation download (must verify via API / SR-Legacy).
# A trailing note explains cultivar/state caveats where the match is approximate.
MATCH = {
    # Fruit (raw)
    "apple": (1750341, "FDC splits by cultivar; using Gala"),
    "banana": (1105314, "ripe & slightly ripe"),
    "orange": (746771, "navels"),
    "strawberries": (2346409, ""), "blueberries": (2346411, ""),
    "raspberries": (2346410, ""), "blackberries": (2727581, ""),
    "grapes": (2346412, "red seedless"),
    "watermelon": (2747675, "flesh only"), "cantaloupe": (746770, ""),
    "pineapple": (2346398, ""), "mango": (2710833, "Tommy Atkins"),
    "peach": (325430, "yellow"), "pear": (746773, "bartlett"),
    "plum": (2710837, "black, with skin"), "cherries": (2346399, "sweet dark red"),
    "kiwi": (327046, ""), "avocado": (2710824, "Hass, peeled"),
    "pomegranate": None,            # only juice in Foundation
    "grapefruit": None,             # only juice in Foundation
    "lemon": None,                  # not in Foundation
    # Vegetable (raw)
    "broccoli": (747447, ""), "spinach": (1999633, "mature"),
    "kale": (323505, ""), "lettuce": (746769, "romaine"),
    "carrot": (2258586, "mature"), "tomato": (1999634, "roma"),
    "cucumber": (2346406, ""), "bell-pepper": (2258590, "red"),
    "onion": (790646, "yellow"), "garlic": (1104647, ""),
    "zucchini": (2685568, ""), "cauliflower": (2685573, ""),
    "green-beans": (2346400, "snap green"), "asparagus": (2710823, ""),
    "mushroom": (1999629, "white button"), "celery": (2346405, ""),
    "corn": (2710826, "fresh sweet"), "brussels-sprouts": (2685575, ""),
    "cabbage": (2346407, "green"),
    "sweet-potato": None,           # base is cooked; Foundation only raw
    "potato": None,                 # base is cooked; Foundation only raw
    "peas": None,                   # Foundation only has canned green peas
    # Meat — base foods are all COOKED; Foundation has raw only
    "chicken-breast": None, "chicken-thigh": None,
    "ground-beef-80-20": None, "ground-beef-90-10": None, "ground-beef-93-7": None,
    "beef-sirloin": None, "ribeye-steak": None, "pork-chop": None,
    "pork-tenderloin": None, "ground-turkey": None, "turkey-breast": None,
    "bacon": (749420, "restaurant, cooked"),     # cooked bacon IS in Foundation
    "ham": (332397, "deli 96% fat free — base may target a fattier ham"),
    # Fish — base cooked; Foundation raw only, except canned tuna
    "salmon": None, "cod": None, "tilapia": None, "shrimp": None, "sardines": None,
    "tuna-canned": (334194, "light, canned in water — exact match"),
    # Grain
    "oats": (2346396, "rolled, old fashioned — dry, exact"),
    "white-rice": None, "brown-rice": None, "quinoa": None, "pasta": None,
    "whole-wheat-bread": None, "white-bread": None, "flour-tortilla": None,
    "couscous": None, "bagel": None,
    # Legume — base cooked-from-dry; Foundation has dry(0% moisture)/canned only
    "black-beans": None, "chickpeas": None, "lentils": None, "kidney-beans": None,
    "tofu": None, "edamame": None,
    # Dairy & Eggs
    "egg": (323604, "raw, frozen, pasteurized"),
    "egg-white": (323697, "raw, frozen, pasteurized"),
    "milk-2": (746778, "exact"), "skim-milk": (746776, "exact"),
    "greek-yogurt": (330137, "exact"), "cottage-cheese": (328841, "exact"),
    "cheddar-cheese": (328637, "exact"),
    "mozzarella": (329370, "base=whole milk; FDC=low-moisture part-skim — differs"),
    "butter": (790508, "salted"),
    # Nuts & Fats
    "almonds": (2346393, "raw"), "walnuts": (2346394, "raw"),
    "peanut-butter": (2262072, "creamy"), "olive-oil": (748608, "extra virgin"),
    "cashews": (2515374, "raw"),
    # Other
    "honey": None, "sugar": (746784, "granulated, exact"), "dark-chocolate": None,
}

def nutmap(food):
    m = {}
    for fn in food.get("foodNutrients", []):
        nid = (fn.get("nutrient") or {}).get("id")
        amt = fn.get("amount")
        if nid is not None and amt is not None and nid not in m:
            m[nid] = (amt, (fn["nutrient"].get("unitName") or "").upper())
    return m

def energy_kcal(m):
    for nid in ENERGY:
        if nid in m:
            amt, unit = m[nid]
            return amt / 4.184 if unit == "KJ" else amt
    return None

def pick(m, ids):
    for i in ids:
        if i in m:
            return m[i][0]
    return None

def fdc_values(food):
    m = nutmap(food)
    v = {"calories": energy_kcal(m), "sodium": m.get(SODIUM, (None,))[0]}
    for k, ids in MACROS.items():
        v[k] = pick(m, ids)
    return v

base = json.load(open(BASE))
by_id = {f["fdcId"]: f for f in json.load(open(FDC))["FoundationFoods"] if isinstance(f, dict)}

NUM = ["calories", "protein", "carbs", "fat", "fiber", "sugar", "satFat", "sodium"]
def tol(k):
    return {"calories": 8, "sodium": 25}.get(k, 1.0)
def fmt(v):
    return "—" if v is None else f"{v:g}"

print(f"FDC file  : {FDC.split('/')[-1]}")
print(f"Base foods: {len(base)}   Foundation records: {len(by_id)}\n")

verified, flagged, not_in = [], [], []
for b in base:
    slug = b["slug"]
    if slug not in MATCH:
        not_in.append((b, "UNMAPPED — add to MATCH"))
        continue
    entry = MATCH[slug]
    if entry is None:
        not_in.append((b, "cooked/absent — not in Foundation set"))
        continue
    fid, note = entry
    food = by_id.get(fid)
    if not food:
        not_in.append((b, f"#{fid} not found in file"))
        continue
    fv = fdc_values(food)
    diffs = []
    for k in NUM:
        bv, f_ = b.get(k), fv.get(k)
        if f_ is None or bv is None:
            continue
        if abs(bv - f_) > tol(k):
            diffs.append((k, bv, f_))
    rec = (b, fid, food["description"], note, diffs, fv)
    (flagged if diffs else verified).append(rec)

print("== SUMMARY ==")
print(f"  ✓ verified (within tolerance)   : {len(verified)}")
print(f"  ⚠ discrepancy vs Foundation     : {len(flagged)}")
print(f"  ○ not verifiable from this file : {len(not_in)}")

print("\n== ⚠ DISCREPANCIES (base vs Foundation, per 100 g) ==")
for b, fid, desc, note, diffs, fv in flagged:
    tag = f"  [{note}]" if note else ""
    print(f"\n  {b['slug']}  →  #{fid} {desc}{tag}")
    for k, bv, f_ in diffs:
        print(f"      {k:9} base={fmt(bv):>7}   fdc={fmt(round(f_,1)):>7}   Δ={f_-bv:+.1f}")

print("\n== ✓ VERIFIED (within tolerance) ==")
for b, fid, desc, note, diffs, fv in verified:
    print(f"  {b['slug']:18} #{fid:<8} {desc[:48]}")

print("\n== ○ NOT VERIFIABLE FROM THIS FOUNDATION FILE ==")
for b, reason in not_in:
    print(f"  {b['slug']:18} {reason}")
