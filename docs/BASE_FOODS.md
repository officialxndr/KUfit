# Base Foods — adding & labeling guide

The bundled "base foods" are common whole foods (apple, chicken breast, oats…) that are
**searchable offline** with the same rich detail card scanned Open Food Facts products get:
macros, an extended micronutrient breakdown, a computed **Nutri-Score**, **NOVA** group,
**allergen** badges, **diet labels** (vegan/vegetarian/gluten-free), and **household portions**
(Small/Medium/Large, cups, tbsp…). Everything is **verifiable** — each food is pulled from a
specific **USDA FoodData Central** record and stamped with its `fdcId`.

Use this guide whenever you add or change a base food so it carries the **same labeling** as the
rest of the catalog.

## Where the data lives

| File | Role |
|---|---|
| `scripts/fetch-base-foods.mjs` | Source of truth for the food list (`CONFIG`), the FDC nutrient mapping, the curated **`PORTIONS`**, and the generator. |
| `scripts/base-foods-fdc.json` | **Lockfile** — `slug → { fdcId, description, dataType }`. The audit artifact; makes every value traceable. |
| `assets/foods/base-ingredients.json` | Generated output (per-100 g macros + micros + nutriScore + nova + portions + `fdcId`). **Don't hand-edit** — regenerate. |
| `src/lib/baseFoodsSeed.ts` | Seeds the DB. Owns the **`ALLERGEN_GROUPS`** map, the **`dietLabels`** derivation, `GLUTEN_FREE`, and `BASE_FOODS_VERSION`. Converts each food → `FoodDetails`. |
| `scripts/verify-base-foods.py` | Independent spot-check of the generated values against the FDC Foundation bulk download. |
| `scripts/audit-lock.py` | Flags lockfile entries that are unresolved, **non-retrievable** (404 on the detail endpoint), or a weak text match; proposes retrievable replacements. |

## What every base food carries

- **Core macros** (per 100 g): calories, protein, carbs, fat, fiber, sugar, satFat, sodium — from the FDC record.
- **Micros** (`micros{}`): vitamins, minerals, the sugar breakdown, starch, beta-carotene, omega-3/6, etc. — whatever the lab record reports. Keys must exist in `NUTRIENT_DEFS` (`src/lib/offNutrients.ts`).
- **`nova`** (1–4) and **`fruitVegPct`** — *curated in CONFIG* (FDC has no such classification).
- **`nutriScore`** — *computed* from the fetched values (2023 solid-food algorithm). Pure fats/oils stay ungraded.
- **Allergens** — from `ALLERGEN_GROUPS` in the seed (keyed by slug), → "Contains milk/nuts/gluten…" badges.
- **Diet labels** — *derived* by `dietLabels()` from category + allergens → Vegan / Vegetarian / Gluten-free badges.
- **`portions`** — curated household measures (`PORTIONS` in the script) → tap-to-fill chips in the quantity sheet.

## Adding a new food — checklist

1. **Add a `CONFIG` row** in `scripts/fetch-base-foods.mjs`:
   ```js
   ['slug', 'Display Name', 'Category', 'fdc search query', nova, fruitVegPct],
   ```
   - **Category**: one of `Fruit, Vegetable, Meat, Fish, Grain, Legume, Dairy & Eggs, Nuts & Fats, Other`.
   - **query**: precise SR-Legacy / Foundation phrasing so the **top hit is right**. Match the intended
     state — `"…cooked, roasted"` vs raw gives very different per-100 g values. *Avoid `/` in the query*
     (FDC search 400s when a query mixes commas and a slash; the audit script strips it on re-resolve).
   - **nova**: `1` whole/raw · `2` pressed/dried sugars & oils (honey, sugar, olive oil) · `3` canned/cheese/
     bread/cooked-from-dry · `4` ultra-processed (deli meats, sausages, plant milks, condiments, candy).
   - **fruitVegPct**: `100` for fruit/veg/legume/nut/seed (raw or plain), `~60–80` for sauces/sweetened,
     `0` for animal/grain/oil/most "Other". Only affects the Nutri-Score.
2. **Resolve + lock**: `FDC_API_KEY=$(cat .fdc-key) node scripts/fetch-base-foods.mjs --write-lock`
3. **Audit**: `python3 scripts/audit-lock.py` (dry-run) → review. It flags failures / non-retrievable pins /
   weak matches and proposes fixes. Apply with `--write`, then **eyeball every new `description`** in the
   lockfile (the resolver can pick the wrong food — e.g. a tortilla query once matched "pesto").
4. **Allergens**: add the slug to the relevant `ALLERGEN_GROUPS` array in `baseFoodsSeed.ts` (milk, eggs,
   nuts, peanuts, soybeans, sesame-seeds, fish, crustaceans, molluscs, gluten). Multiple is fine.
   Add to `GLUTEN_FREE` if it's a naturally gluten-free staple worth the badge.
5. **Portions** *(discrete or common-measure foods)*: add to `PORTIONS` in the script —
   `slug: [['Label', grams], …]` from the food's USDA `foodPortions` (Small/Medium/Large, 1 cup, 1 tbsp,
   1 slice, 3 oz…). Keep to ~2–4 of the most common; cap clutter. Amorphous foods can skip it.
6. **Generate**: `FDC_API_KEY=$(cat .fdc-key) node scripts/fetch-base-foods.mjs --write`
7. **Bump** `BASE_FOODS_VERSION` in `baseFoodsSeed.ts` (so existing installs re-seed in place).
8. **Verify**: `npx tsc --noEmit` · `python3 scripts/verify-base-foods.py` · headless bundle.
9. **Docs**: note the change in `docs/ROADMAP.md` / `docs/ARCHITECTURE.md`.

## Diet-label rules (`dietLabels`)

- **Vegetarian** — anything not in the `Meat` or `Fish` category.
- **Vegan** — vegetarian **and** no `en:milk` / `en:eggs` allergen **and** not honey.
- **Gluten-free** — only the curated `GLUTEN_FREE` staples (avoids over-claiming on every random food).

Because labels are *derived*, you usually only touch allergens — vegan/vegetarian follow automatically
(e.g. add a new cheese to `en:milk` and it correctly becomes Vegetarian-but-not-Vegan).

## FDC gotchas the tooling already handles

- **µg units** — `String.toUpperCase()` maps the micro sign `µ` (U+00B5) to Greek Mu, so a naive match drops
  every microgram nutrient. `toGrams` normalizes both mu codepoints.
- **Detail-endpoint 404s** — some older Foundation `fdcId`s appear in search but 404 on `/food/{id}`. The
  audit re-pins these to a **retrievable** SR-Legacy equivalent.
- **Search 400** — a query with commas **and** a `/` is rejected; strip the slash.
- **Foundation vs SR Legacy** — Foundation = richer micros but sometimes missing core rollups (fiber under
  id `2033` not `1079`; no total-sugars/satfat). The script falls back (2033 fiber, summed sugar components);
  if a Foundation record is still missing a core macro, pin the SR-Legacy equivalent instead.

## Attribution

ExerciseDB/AscendAPI and **USDA FoodData Central** + Open Food Facts (ODbL) are credited in
Settings → About & credits. Keep it.
