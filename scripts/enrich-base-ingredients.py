#!/usr/bin/env python3
"""
Enrich assets/foods/base-ingredients.json with extended nutrition:
  - fiber / sugar / satFat / sodium (per 100 g)
  - a curated micronutrient set (per 100 g, in display units: g / mg / µg)
  - NOVA processing group
  - a computed 2023 Nutri-Score grade (a–e)

Values are curated USDA FoodData Central per-100 g references for whole foods.
They are intentionally approximate base-line figures, not lab-exact per-lot data.

Run from repo root:  python3 scripts/enrich-base-ingredients.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/foods/base-ingredients.json")

# fvp = fruit/veg/legume/nut % (Nutri-Score positive). nova = processing group.
# micros in display units: minerals/most vitamins = mg, vitamin-a/d/k/b9/b12/selenium = µg,
# omega-3-fat = g. Keys must match NUTRIENT_DEFS in src/lib/offNutrients.ts.
EXTRA = {
    # ── Fruit (fvp 100, nova 1) ────────────────────────────────────────────────
    "apple":        dict(fiber=2.4, sugar=10.4, satFat=0.0, sodium=1, fvp=100, nova=1, micros={"potassium":107,"vitamin-c":4.6}),
    "banana":       dict(fiber=2.6, sugar=12.2, satFat=0.1, sodium=1, fvp=100, nova=1, micros={"potassium":358,"vitamin-c":8.7,"vitamin-b6":0.37,"magnesium":27}),
    "orange":       dict(fiber=2.4, sugar=9.4,  satFat=0.0, sodium=0, fvp=100, nova=1, micros={"vitamin-c":53.2,"potassium":181,"calcium":40,"vitamin-b9":30}),
    "strawberries": dict(fiber=2.0, sugar=4.9,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":58.8,"potassium":153,"vitamin-b9":24,"manganese":0.39}),
    "blueberries":  dict(fiber=2.4, sugar=10.0, satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":9.7,"vitamin-k":19.3,"potassium":77,"manganese":0.34}),
    "raspberries":  dict(fiber=6.5, sugar=4.4,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":26.2,"potassium":151,"magnesium":22,"manganese":0.67}),
    "blackberries": dict(fiber=5.3, sugar=4.9,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":21,"vitamin-k":19.8,"potassium":162,"manganese":0.65}),
    "grapes":       dict(fiber=0.9, sugar=15.5, satFat=0.0, sodium=2, fvp=100, nova=1, micros={"vitamin-k":14.6,"potassium":191,"vitamin-c":3.2}),
    "watermelon":   dict(fiber=0.4, sugar=6.2,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":8.1,"vitamin-a":28,"potassium":112}),
    "cantaloupe":   dict(fiber=0.9, sugar=7.9,  satFat=0.0, sodium=16,fvp=100, nova=1, micros={"vitamin-c":36.7,"vitamin-a":169,"potassium":267}),
    "pineapple":    dict(fiber=1.4, sugar=9.9,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":47.8,"manganese":0.93,"potassium":109}),
    "mango":        dict(fiber=1.6, sugar=13.7, satFat=0.1, sodium=1, fvp=100, nova=1, micros={"vitamin-c":36.4,"vitamin-a":54,"potassium":168,"vitamin-b9":43}),
    "peach":        dict(fiber=1.5, sugar=8.4,  satFat=0.0, sodium=0, fvp=100, nova=1, micros={"vitamin-c":6.6,"potassium":190,"vitamin-a":16}),
    "pear":         dict(fiber=3.1, sugar=9.8,  satFat=0.0, sodium=1, fvp=100, nova=1, micros={"vitamin-c":4.3,"potassium":116,"vitamin-k":4.4}),
    "plum":         dict(fiber=1.4, sugar=9.9,  satFat=0.0, sodium=0, fvp=100, nova=1, micros={"vitamin-c":9.5,"vitamin-k":6.4,"potassium":157}),
    "cherries":     dict(fiber=2.1, sugar=12.8, satFat=0.0, sodium=0, fvp=100, nova=1, micros={"vitamin-c":7,"potassium":222}),
    "kiwi":         dict(fiber=3.0, sugar=9.0,  satFat=0.1, sodium=3, fvp=100, nova=1, micros={"vitamin-c":92.7,"vitamin-k":40.3,"potassium":312}),
    "pomegranate":  dict(fiber=4.0, sugar=13.7, satFat=0.1, sodium=3, fvp=100, nova=1, micros={"vitamin-c":10.2,"vitamin-k":16.4,"potassium":236,"vitamin-b9":38}),
    "avocado":      dict(fiber=6.7, sugar=0.7,  satFat=2.1, sodium=7, fvp=100, nova=1, micros={"potassium":485,"vitamin-k":21,"vitamin-b9":81,"magnesium":29,"vitamin-e":2.1}),
    "grapefruit":   dict(fiber=1.6, sugar=6.9,  satFat=0.0, sodium=0, fvp=100, nova=1, micros={"vitamin-c":31.2,"vitamin-a":58,"potassium":135}),
    "lemon":        dict(fiber=2.8, sugar=2.5,  satFat=0.0, sodium=2, fvp=100, nova=1, micros={"vitamin-c":53,"potassium":138}),
    # ── Vegetable (fvp 100, nova 1) ────────────────────────────────────────────
    "broccoli":         dict(fiber=2.6, sugar=1.7, satFat=0.0, sodium=33, fvp=100, nova=1, micros={"vitamin-c":89.2,"vitamin-k":101.6,"vitamin-b9":63,"potassium":316,"calcium":47}),
    "spinach":          dict(fiber=2.2, sugar=0.4, satFat=0.0, sodium=79, fvp=100, nova=1, micros={"vitamin-k":482.9,"vitamin-a":469,"vitamin-b9":194,"iron":2.7,"potassium":558,"magnesium":79}),
    "kale":             dict(fiber=3.6, sugar=0.8, satFat=0.1, sodium=38, fvp=100, nova=1, micros={"vitamin-k":389.6,"vitamin-c":93.4,"vitamin-a":241,"calcium":150,"potassium":348}),
    "lettuce":          dict(fiber=1.3, sugar=0.8, satFat=0.0, sodium=28, fvp=100, nova=1, micros={"vitamin-k":126.3,"vitamin-a":370,"vitamin-b9":38,"potassium":194}),
    "carrot":           dict(fiber=2.8, sugar=4.7, satFat=0.0, sodium=69, fvp=100, nova=1, micros={"vitamin-a":835,"vitamin-k":13.2,"potassium":320}),
    "sweet-potato":     dict(fiber=3.3, sugar=6.5, satFat=0.0, sodium=36, fvp=100, nova=1, micros={"vitamin-a":961,"vitamin-c":19.6,"potassium":475,"manganese":0.5}),
    "potato":           dict(fiber=1.8, sugar=0.9, satFat=0.0, sodium=5,  fvp=100, nova=1, micros={"vitamin-c":13,"potassium":379,"vitamin-b6":0.3}),
    "tomato":           dict(fiber=1.2, sugar=2.6, satFat=0.0, sodium=5,  fvp=100, nova=1, micros={"vitamin-c":13.7,"vitamin-a":42,"potassium":237,"vitamin-k":7.9}),
    "cucumber":         dict(fiber=0.5, sugar=1.7, satFat=0.0, sodium=2,  fvp=100, nova=1, micros={"vitamin-k":16.4,"potassium":147,"vitamin-c":2.8}),
    "bell-pepper":      dict(fiber=2.1, sugar=4.2, satFat=0.0, sodium=4,  fvp=100, nova=1, micros={"vitamin-c":127.7,"vitamin-a":157,"vitamin-b6":0.29,"potassium":211}),
    "onion":            dict(fiber=1.7, sugar=4.2, satFat=0.0, sodium=4,  fvp=100, nova=1, micros={"vitamin-c":7.4,"potassium":146,"vitamin-b6":0.12}),
    "garlic":           dict(fiber=2.1, sugar=1.0, satFat=0.1, sodium=17, fvp=100, nova=1, micros={"vitamin-c":31.2,"manganese":1.67,"vitamin-b6":1.24,"calcium":181,"potassium":401}),
    "zucchini":         dict(fiber=1.0, sugar=2.5, satFat=0.1, sodium=8,  fvp=100, nova=1, micros={"vitamin-c":17.9,"vitamin-b6":0.16,"potassium":261}),
    "cauliflower":      dict(fiber=2.0, sugar=1.9, satFat=0.1, sodium=30, fvp=100, nova=1, micros={"vitamin-c":48.2,"vitamin-k":15.5,"vitamin-b9":57,"potassium":299}),
    "green-beans":      dict(fiber=2.7, sugar=3.3, satFat=0.1, sodium=6,  fvp=100, nova=1, micros={"vitamin-c":12.2,"vitamin-k":43,"potassium":211,"vitamin-a":35}),
    "asparagus":        dict(fiber=2.1, sugar=1.9, satFat=0.0, sodium=2,  fvp=100, nova=1, micros={"vitamin-k":41.6,"vitamin-b9":52,"vitamin-a":38,"potassium":202}),
    "mushroom":         dict(fiber=1.0, sugar=2.0, satFat=0.1, sodium=5,  fvp=100, nova=1, micros={"vitamin-d":0.2,"potassium":318,"selenium":9.3,"vitamin-pp":3.6}),
    "celery":           dict(fiber=1.6, sugar=1.3, satFat=0.0, sodium=80, fvp=100, nova=1, micros={"vitamin-k":29.3,"potassium":260,"vitamin-a":22}),
    "corn":             dict(fiber=2.4, sugar=3.2, satFat=0.1, sodium=15, fvp=100, nova=1, micros={"vitamin-c":6.8,"vitamin-b9":42,"potassium":270,"magnesium":37}),
    "peas":             dict(fiber=5.7, sugar=5.7, satFat=0.1, sodium=5,  fvp=100, nova=1, micros={"vitamin-c":40,"vitamin-k":24.8,"vitamin-a":38,"vitamin-b9":65,"potassium":244}),
    "brussels-sprouts": dict(fiber=3.8, sugar=2.2, satFat=0.1, sodium=25, fvp=100, nova=1, micros={"vitamin-c":85,"vitamin-k":177,"vitamin-b9":61,"potassium":389}),
    "cabbage":          dict(fiber=2.5, sugar=3.2, satFat=0.0, sodium=18, fvp=100, nova=1, micros={"vitamin-c":36.6,"vitamin-k":76,"vitamin-b9":43,"potassium":170}),
    # ── Meat (fvp 0) ───────────────────────────────────────────────────────────
    "chicken-breast":    dict(fiber=0, sugar=0,   satFat=1.0,  sodium=74,  fvp=0, nova=1, micros={"potassium":256,"phosphorus":228,"selenium":27.6,"vitamin-b6":0.6,"vitamin-pp":13.7,"zinc":1.0}),
    "chicken-thigh":     dict(fiber=0, sugar=0,   satFat=2.7,  sodium=88,  fvp=0, nova=1, micros={"potassium":230,"phosphorus":200,"zinc":2.1,"selenium":24}),
    "ground-beef-80-20": dict(fiber=0, sugar=0,   satFat=7.2,  sodium=75,  fvp=0, nova=1, micros={"zinc":5.5,"vitamin-b12":2.4,"iron":2.4,"phosphorus":180,"selenium":19,"potassium":290}),
    "ground-beef-90-10": dict(fiber=0, sugar=0,   satFat=4.5,  sodium=72,  fvp=0, nova=1, micros={"zinc":6.0,"vitamin-b12":2.5,"iron":2.6,"phosphorus":200,"potassium":320}),
    "ground-beef-93-7":  dict(fiber=0, sugar=0,   satFat=3.0,  sodium=70,  fvp=0, nova=1, micros={"zinc":6.2,"vitamin-b12":2.6,"iron":2.7,"phosphorus":210,"potassium":330}),
    "beef-sirloin":      dict(fiber=0, sugar=0,   satFat=4.0,  sodium=55,  fvp=0, nova=1, micros={"zinc":4.5,"vitamin-b12":1.5,"iron":1.6,"selenium":30,"potassium":330}),
    "ribeye-steak":      dict(fiber=0, sugar=0,   satFat=9.0,  sodium=60,  fvp=0, nova=1, micros={"zinc":4.8,"vitamin-b12":2.1,"iron":2.0,"potassium":300}),
    "pork-chop":         dict(fiber=0, sugar=0,   satFat=3.8,  sodium=62,  fvp=0, nova=1, micros={"vitamin-b1":0.7,"selenium":38,"zinc":2.5,"potassium":380,"phosphorus":220}),
    "pork-tenderloin":   dict(fiber=0, sugar=0,   satFat=1.5,  sodium=55,  fvp=0, nova=1, micros={"vitamin-b1":0.8,"selenium":40,"potassium":400,"phosphorus":240}),
    "bacon":             dict(fiber=0, sugar=0,   satFat=12.0, sodium=1700,fvp=0, nova=4, micros={"selenium":45,"zinc":2.5,"phosphorus":300}),
    "ham":               dict(fiber=0, sugar=1.5, satFat=2.0,  sodium=1200,fvp=0, nova=4, micros={"selenium":25,"vitamin-b1":0.6,"zinc":1.8,"potassium":290}),
    "ground-turkey":     dict(fiber=0, sugar=0,   satFat=3.0,  sodium=80,  fvp=0, nova=1, micros={"selenium":30,"zinc":3.0,"vitamin-b6":0.4,"phosphorus":230,"potassium":290}),
    "turkey-breast":     dict(fiber=0, sugar=0,   satFat=0.4,  sodium=60,  fvp=0, nova=1, micros={"selenium":30,"vitamin-pp":9.0,"vitamin-b6":0.6,"phosphorus":210,"potassium":300}),
    # ── Fish ───────────────────────────────────────────────────────────────────
    "salmon":      dict(fiber=0, sugar=0, satFat=3.0, sodium=60,  fvp=0, nova=1, micros={"vitamin-d":13.1,"vitamin-b12":3.2,"selenium":41,"potassium":384,"omega-3-fat":2.3}),
    "cod":         dict(fiber=0, sugar=0, satFat=0.1, sodium=78,  fvp=0, nova=1, micros={"vitamin-b12":1.0,"selenium":33,"phosphorus":200,"potassium":244}),
    "tuna-canned": dict(fiber=0, sugar=0, satFat=0.2, sodium=247, fvp=0, nova=3, micros={"vitamin-d":1.7,"vitamin-b12":2.5,"selenium":65,"vitamin-pp":11,"potassium":200}),
    "tilapia":     dict(fiber=0, sugar=0, satFat=1.0, sodium=56,  fvp=0, nova=1, micros={"vitamin-b12":1.9,"selenium":54,"phosphorus":200,"potassium":380}),
    "shrimp":      dict(fiber=0, sugar=0, satFat=0.1, sodium=111, fvp=0, nova=1, micros={"selenium":40,"vitamin-b12":1.5,"phosphorus":240}),
    "sardines":    dict(fiber=0, sugar=0, satFat=1.5, sodium=307, fvp=0, nova=3, micros={"calcium":382,"vitamin-d":4.8,"vitamin-b12":8.9,"omega-3-fat":1.4,"selenium":53}),
    # ── Grain ──────────────────────────────────────────────────────────────────
    "white-rice":        dict(fiber=0.4,  sugar=0.1, satFat=0.1, sodium=1,   fvp=0, nova=1, micros={"manganese":0.5,"potassium":35}),
    "brown-rice":        dict(fiber=1.8,  sugar=0.4, satFat=0.2, sodium=5,   fvp=0, nova=1, micros={"magnesium":43,"manganese":1.1,"phosphorus":103,"potassium":79}),
    "quinoa":            dict(fiber=2.8,  sugar=0.9, satFat=0.3, sodium=7,   fvp=0, nova=1, micros={"magnesium":64,"phosphorus":152,"vitamin-b9":42,"iron":1.5,"potassium":172}),
    "oats":              dict(fiber=10.6, sugar=1.0, satFat=1.2, sodium=2,   fvp=0, nova=1, micros={"magnesium":177,"phosphorus":523,"iron":4.7,"zinc":4.0,"manganese":4.9}),
    "pasta":             dict(fiber=1.8,  sugar=0.6, satFat=0.1, sodium=1,   fvp=0, nova=3, micros={"selenium":26,"manganese":0.3,"vitamin-b9":18}),
    "whole-wheat-bread": dict(fiber=7.0,  sugar=6.0, satFat=0.6, sodium=450, fvp=0, nova=3, micros={"iron":2.5,"magnesium":75,"vitamin-b9":42,"potassium":250}),
    "white-bread":       dict(fiber=2.7,  sugar=5.0, satFat=0.7, sodium=490, fvp=0, nova=4, micros={"iron":3.6,"calcium":150,"vitamin-b9":97,"vitamin-b1":0.5}),
    "flour-tortilla":    dict(fiber=3.0,  sugar=2.0, satFat=2.0, sodium=590, fvp=0, nova=3, micros={"iron":3.6,"calcium":120}),
    "couscous":          dict(fiber=1.4,  sugar=0.1, satFat=0.0, sodium=5,   fvp=0, nova=3, micros={"selenium":27,"vitamin-b9":15}),
    "bagel":             dict(fiber=2.3,  sugar=5.0, satFat=0.3, sodium=430, fvp=0, nova=3, micros={"iron":3.8,"vitamin-b9":100,"selenium":30}),
    # ── Legume (fvp 100) ───────────────────────────────────────────────────────
    "black-beans":  dict(fiber=8.7, sugar=0.3, satFat=0.1, sodium=1, fvp=100, nova=1, micros={"vitamin-b9":149,"magnesium":70,"iron":2.1,"potassium":355,"phosphorus":140}),
    "chickpeas":    dict(fiber=7.6, sugar=4.8, satFat=0.4, sodium=7, fvp=100, nova=1, micros={"vitamin-b9":172,"iron":2.9,"magnesium":48,"potassium":291,"zinc":1.5}),
    "lentils":      dict(fiber=7.9, sugar=1.8, satFat=0.1, sodium=2, fvp=100, nova=1, micros={"vitamin-b9":181,"iron":3.3,"potassium":369,"magnesium":36,"phosphorus":180}),
    "kidney-beans": dict(fiber=6.4, sugar=0.3, satFat=0.1, sodium=1, fvp=100, nova=1, micros={"vitamin-b9":130,"iron":2.2,"potassium":405,"magnesium":45}),
    "tofu":         dict(fiber=0.9, sugar=0.6, satFat=0.7, sodium=7, fvp=100, nova=3, micros={"calcium":350,"iron":2.7,"magnesium":58,"phosphorus":190,"manganese":1.2}),
    "edamame":      dict(fiber=5.2, sugar=2.2, satFat=0.6, sodium=6, fvp=100, nova=1, micros={"vitamin-b9":311,"vitamin-k":26.7,"iron":2.3,"magnesium":64,"potassium":436}),
    # ── Dairy & Eggs ───────────────────────────────────────────────────────────
    "egg":            dict(fiber=0, sugar=1.1, satFat=3.3,  sodium=142, fvp=0, nova=1, micros={"vitamin-b12":0.9,"vitamin-d":2.0,"selenium":30.7,"vitamin-a":160,"phosphorus":198,"vitamin-b2":0.46}),
    "egg-white":      dict(fiber=0, sugar=0.7, satFat=0.0,  sodium=166, fvp=0, nova=1, micros={"selenium":20,"potassium":163,"vitamin-b2":0.44}),
    "milk-2":         dict(fiber=0, sugar=4.9, satFat=1.2,  sodium=47,  fvp=0, nova=1, micros={"calcium":120,"vitamin-d":1.1,"vitamin-b12":0.5,"potassium":150,"phosphorus":95}),
    "skim-milk":      dict(fiber=0, sugar=5.0, satFat=0.1,  sodium=42,  fvp=0, nova=1, micros={"calcium":122,"vitamin-d":1.0,"vitamin-b12":0.5,"potassium":156}),
    "greek-yogurt":   dict(fiber=0, sugar=3.6, satFat=0.1,  sodium=36,  fvp=0, nova=1, micros={"calcium":110,"vitamin-b12":0.75,"potassium":141,"phosphorus":135}),
    "cottage-cheese": dict(fiber=0, sugar=2.7, satFat=1.7,  sodium=364, fvp=0, nova=3, micros={"calcium":83,"vitamin-b12":0.4,"selenium":9,"phosphorus":159}),
    "cheddar-cheese": dict(fiber=0, sugar=0.5, satFat=19.0, sodium=621, fvp=0, nova=3, micros={"calcium":721,"vitamin-a":265,"vitamin-b12":1.1,"phosphorus":512,"zinc":3.1}),
    "mozzarella":     dict(fiber=0, sugar=1.0, satFat=10.0, sodium=627, fvp=0, nova=3, micros={"calcium":505,"phosphorus":354,"vitamin-b12":0.9,"zinc":2.9}),
    "butter":         dict(fiber=0, sugar=0.1, satFat=51.0, sodium=11,  fvp=0, nova=2, micros={"vitamin-a":684}),
    # ── Nuts & Fats ────────────────────────────────────────────────────────────
    "almonds":       dict(fiber=12.5, sugar=4.4, satFat=3.8,  sodium=1,  fvp=100, nova=1, micros={"vitamin-e":25.6,"magnesium":270,"calcium":269,"potassium":733,"vitamin-b2":1.1}),
    "walnuts":       dict(fiber=6.7,  sugar=2.6, satFat=1.7,  sodium=2,  fvp=100, nova=1, micros={"magnesium":158,"omega-3-fat":9.0,"potassium":441,"phosphorus":346}),
    "peanut-butter": dict(fiber=6.0,  sugar=9.0, satFat=10.0, sodium=17, fvp=100, nova=4, micros={"magnesium":154,"vitamin-e":9.0,"potassium":649,"vitamin-pp":13}),
    "olive-oil":     dict(fiber=0,    sugar=0,   satFat=13.8, sodium=2,  fvp=0,   nova=2, micros={"vitamin-e":14.4,"vitamin-k":60.2}),
    "cashews":       dict(fiber=3.3,  sugar=5.9, satFat=7.8,  sodium=12, fvp=100, nova=1, micros={"magnesium":292,"iron":6.7,"zinc":5.8,"potassium":660,"phosphorus":593}),
    # ── Other ──────────────────────────────────────────────────────────────────
    "honey":          dict(fiber=0.2, sugar=82.0, satFat=0.0,  sodium=4,  fvp=0, nova=2, micros={"potassium":52}),
    "sugar":          dict(fiber=0,   sugar=100.0,satFat=0.0,  sodium=0,  fvp=0, nova=2, micros={}),
    "dark-chocolate": dict(fiber=11.0,sugar=24.0, satFat=24.0, sodium=20, fvp=0, nova=4, micros={"iron":11.9,"magnesium":228,"potassium":715,"copper":1.77}),
}


# ── Nutri-Score 2023 (general "solid food" algorithm) ──────────────────────────
def _pts(value, thresholds):
    """thresholds: list of upper bounds; returns index of first bound value <= bound."""
    for i, t in enumerate(thresholds):
        if value <= t:
            return i
    return len(thresholds)

def nutri_score(kcal, sugar, satfat, sodium_mg, fiber, protein, fvp):
    energy_kj = kcal * 4.184
    salt = sodium_mg * 2.5 / 1000.0  # sodium(mg) → salt(g)
    n_energy = _pts(energy_kj, [335,670,1005,1340,1675,2010,2345,2680,3015,3350])
    n_sugar  = _pts(sugar,  [3.4,6.8,10,14,17,20,24,27,31,34,37,41,44,48,51])
    n_satfat = _pts(satfat, [1,2,3,4,5,6,7,8,9,10])
    n_salt   = _pts(salt,   [0.2,0.4,0.6,0.8,1.0,1.2,1.4,1.6,1.8,2.0,2.2,2.4,2.6,2.8,3.0,3.2,3.4,3.6,3.8,4.0])
    N = n_energy + n_sugar + n_satfat + n_salt

    p_fiber   = _pts(fiber,   [3.0,4.1,5.2,6.3,7.4])
    p_protein = _pts(protein, [2.4,4.8,7.2,9.6,12,14,17])
    p_fvp     = 0 if fvp <= 40 else 1 if fvp <= 60 else 2 if fvp <= 80 else 5

    # Protein only counts when N < 11, unless fruit/veg already maxed.
    P = p_fiber + p_fvp + (p_protein if (N < 11 or p_fvp == 5) else 0)
    score = N - P
    if score <= 0:  return "a"
    if score <= 2:  return "b"
    if score <= 10: return "c"
    if score <= 18: return "d"
    return "e"


def main():
    foods = json.load(open(SRC))
    missing = [f["slug"] for f in foods if f["slug"] not in EXTRA]
    if missing:
        raise SystemExit(f"Missing enrichment for: {missing}")

    for f in foods:
        e = EXTRA[f["slug"]]
        f["fiber"] = e["fiber"]
        f["sugar"] = e["sugar"]
        f["satFat"] = e["satFat"]
        f["sodium"] = e["sodium"]
        f["nova"] = e["nova"]
        f["fruitVegPct"] = e["fvp"]
        f["micros"] = e["micros"]
        # Pure added fats/oils fall in a special Nutri-Score category the general
        # solid-food formula gets wrong (olive oil → E), so leave them ungraded.
        f["nutriScore"] = None if f["slug"] in ("olive-oil", "butter") else nutri_score(
            f["calories"], e["sugar"], e["satFat"], e["sodium"], e["fiber"], f["protein"], e["fvp"]
        )

    json.dump(foods, open(SRC, "w"), indent=2, ensure_ascii=False)
    print(f"Enriched {len(foods)} base ingredients.")
    from collections import Counter
    print("Nutri-Score spread:", dict(sorted(Counter(f["nutriScore"] or "—" for f in foods).items())))
    print("NOVA spread:", dict(sorted(Counter(f["nova"] for f in foods).items())))


if __name__ == "__main__":
    main()
