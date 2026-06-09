#!/usr/bin/env node
/**
 * Generate assets/foods/base-ingredients.json from USDA FoodData Central (FDC) —
 * the US government's lab-analyzed nutrition database — so the bundled base-food
 * macros + micros are VERIFIABLE rather than hand-typed.
 *
 * For each curated staple we resolve a single canonical FDC record (Foundation /
 * SR Legacy = lab-analyzed whole foods) and pull its authoritative per-100 g
 * values. The resolved `fdcId` is written into:
 *   - assets/foods/base-ingredients.json  (each food carries its `fdcId` for traceability)
 *   - scripts/base-foods-fdc.json          (the lockfile — slug → {fdcId, description})
 * The lockfile is the audit artifact: anyone can open it, look up the fdcId at
 * https://fdc.nal.usda.gov/fdc-app.html#/food-details/<fdcId> and confirm the values.
 *
 * NOVA processing group + fruit/veg/legume/nut % are CLASSIFICATIONS FDC does not
 * provide — they stay curated here (CONFIG below). The Nutri-Score is computed from
 * the fetched values (2023 solid-food algorithm), matching the old enrich script.
 *
 * USAGE (needs a free key from https://fdc.nal.usda.gov/api-key-signup.html):
 *   export FDC_API_KEY=...            # or pass --api-key=...
 *   node scripts/fetch-base-foods.mjs               # dry-run report (no files written)
 *   node scripts/fetch-base-foods.mjs --write-lock  # resolve + write the lockfile only (audit it!)
 *   node scripts/fetch-base-foods.mjs --write        # generate base-ingredients.json (uses lockfile if present)
 *   node scripts/fetch-base-foods.mjs --relock --write-lock  # ignore lockfile, re-resolve everything
 *
 * Recommended flow: --write-lock → open scripts/base-foods-fdc.json and sanity-check
 * each `description` (fix any wrong fdcId by hand) → --write → bump BASE_FOODS_VERSION
 * in src/lib/baseFoodsSeed.ts so installs re-seed.
 *
 * A food that fails to resolve/fetch is NOT dropped — its existing JSON entry is
 * preserved (so a network hiccup can't shrink the catalog / orphan a logged food)
 * and reported loudly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'assets/foods/base-ingredients.json');
const LOCK = path.join(ROOT, 'scripts/base-foods-fdc.json');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const API_KEY =
  (args.find((a) => a.startsWith('--api-key=')) || '').split('=')[1] || process.env.FDC_API_KEY;
const WRITE = has('--write');
const WRITE_LOCK = has('--write-lock');
const RELOCK = has('--relock');

// ── Curated base foods ──────────────────────────────────────────────────────────
// query: an FDC search string (precise SR Legacy / Foundation phrasing → resolves as
//   the top hit). nova / fvp: classifications FDC can't give. name/category: display.
// "(cooked)" etc. in the name is reflected in the query — cooked vs raw per-100 g
// values differ a lot, so the query must match the intended state.
const CONFIG = [
  // ── Fruit (raw) ──
  ['apple', 'Apple', 'Fruit', 'apple, raw, with skin', 1, 100],
  ['banana', 'Banana', 'Fruit', 'banana, raw', 1, 100],
  ['orange', 'Orange', 'Fruit', 'orange, raw, all commercial varieties', 1, 100],
  ['strawberries', 'Strawberries', 'Fruit', 'strawberries, raw', 1, 100],
  ['blueberries', 'Blueberries', 'Fruit', 'blueberries, raw', 1, 100],
  ['raspberries', 'Raspberries', 'Fruit', 'raspberries, raw', 1, 100],
  ['blackberries', 'Blackberries', 'Fruit', 'blackberries, raw', 1, 100],
  ['grapes', 'Grapes', 'Fruit', 'grapes, red or green, raw', 1, 100],
  ['watermelon', 'Watermelon', 'Fruit', 'watermelon, raw', 1, 100],
  ['cantaloupe', 'Cantaloupe', 'Fruit', 'melons, cantaloupe, raw', 1, 100],
  ['pineapple', 'Pineapple', 'Fruit', 'pineapple, raw, all varieties', 1, 100],
  ['mango', 'Mango', 'Fruit', 'mangos, raw', 1, 100],
  ['peach', 'Peach', 'Fruit', 'peaches, raw', 1, 100],
  ['pear', 'Pear', 'Fruit', 'pears, raw', 1, 100],
  ['plum', 'Plum', 'Fruit', 'plums, raw', 1, 100],
  ['cherries', 'Cherries', 'Fruit', 'cherries, sweet, raw', 1, 100],
  ['kiwi', 'Kiwi', 'Fruit', 'kiwifruit, green, raw', 1, 100],
  ['pomegranate', 'Pomegranate', 'Fruit', 'pomegranate, raw', 1, 100],
  ['avocado', 'Avocado', 'Fruit', 'avocados, raw, all commercial varieties', 1, 100],
  ['grapefruit', 'Grapefruit', 'Fruit', 'grapefruit, raw, pink and red and white, all areas', 1, 100],
  ['lemon', 'Lemon', 'Fruit', 'lemons, raw, without peel', 1, 100],
  // ── Vegetable ──
  ['broccoli', 'Broccoli', 'Vegetable', 'broccoli, raw', 1, 100],
  ['spinach', 'Spinach', 'Vegetable', 'spinach, raw', 1, 100],
  ['kale', 'Kale', 'Vegetable', 'kale, raw', 1, 100],
  ['lettuce', 'Lettuce', 'Vegetable', 'lettuce, romaine, raw', 1, 100],
  ['carrot', 'Carrot', 'Vegetable', 'carrots, raw', 1, 100],
  ['sweet-potato', 'Sweet Potato (cooked)', 'Vegetable', 'sweet potato, cooked, baked in skin, flesh, without salt', 1, 100],
  ['potato', 'Potato (cooked)', 'Vegetable', 'potatoes, boiled, cooked without skin, flesh, without salt', 1, 100],
  ['tomato', 'Tomato', 'Vegetable', 'tomatoes, red, ripe, raw, year round average', 1, 100],
  ['cucumber', 'Cucumber', 'Vegetable', 'cucumber, with peel, raw', 1, 100],
  ['bell-pepper', 'Bell Pepper', 'Vegetable', 'peppers, sweet, red, raw', 1, 100],
  ['onion', 'Onion', 'Vegetable', 'onions, raw', 1, 100],
  ['garlic', 'Garlic', 'Vegetable', 'garlic, raw', 1, 100],
  ['zucchini', 'Zucchini', 'Vegetable', 'squash, summer, zucchini, includes skin, raw', 1, 100],
  ['cauliflower', 'Cauliflower', 'Vegetable', 'cauliflower, raw', 1, 100],
  ['green-beans', 'Green Beans', 'Vegetable', 'beans, snap, green, raw', 1, 100],
  ['asparagus', 'Asparagus', 'Vegetable', 'asparagus, raw', 1, 100],
  ['mushroom', 'Mushroom', 'Vegetable', 'mushrooms, white, raw', 1, 100],
  ['celery', 'Celery', 'Vegetable', 'celery, raw', 1, 100],
  ['corn', 'Corn', 'Vegetable', 'corn, sweet, yellow, raw', 1, 100],
  ['peas', 'Peas', 'Vegetable', 'peas, green, raw', 1, 100],
  ['brussels-sprouts', 'Brussels Sprouts', 'Vegetable', 'brussels sprouts, raw', 1, 100],
  ['cabbage', 'Cabbage', 'Vegetable', 'cabbage, raw', 1, 100],
  // ── Meat (cooked) ──
  ['chicken-breast', 'Chicken Breast (cooked)', 'Meat', 'chicken, broilers or fryers, breast, meat only, cooked, roasted', 1, 0],
  ['chicken-thigh', 'Chicken Thigh (cooked)', 'Meat', 'chicken, broilers or fryers, thigh, meat only, cooked, roasted', 1, 0],
  ['ground-beef-80-20', 'Ground Beef 80/20 (cooked)', 'Meat', 'beef, ground, 80% lean meat / 20% fat, patty, cooked, pan-broiled', 1, 0],
  ['ground-beef-90-10', 'Ground Beef 90/10 (cooked)', 'Meat', 'beef, ground, 90% lean meat / 10% fat, patty, cooked, pan-broiled', 1, 0],
  ['ground-beef-93-7', 'Ground Beef 93/7 (cooked)', 'Meat', 'beef, ground, 93% lean meat / 7% fat, patty, cooked, pan-broiled', 1, 0],
  ['beef-sirloin', 'Beef Sirloin (cooked)', 'Meat', 'beef, top sirloin, steak, separable lean only, trimmed to 1/8 fat, all grades, cooked, broiled', 1, 0],
  ['ribeye-steak', 'Ribeye Steak (cooked)', 'Meat', 'beef, rib eye steak, boneless, lip-on, separable lean only, trimmed to 1/8 fat, all grades, cooked, grilled', 1, 0],
  ['pork-chop', 'Pork Chop (cooked)', 'Meat', 'pork, fresh, loin, center loin (chops), bone-in, separable lean only, cooked, broiled', 1, 0],
  ['pork-tenderloin', 'Pork Tenderloin (cooked)', 'Meat', 'pork, fresh, loin, tenderloin, separable lean only, cooked, roasted', 1, 0],
  ['bacon', 'Bacon (cooked)', 'Meat', 'pork, cured, bacon, cooked, pan-fried', 4, 0],
  ['ham', 'Ham', 'Meat', 'ham, sliced, regular (approximately 11% fat)', 4, 0],
  ['ground-turkey', 'Ground Turkey (cooked)', 'Meat', 'turkey, ground, cooked', 1, 0],
  ['turkey-breast', 'Turkey Breast (cooked)', 'Meat', 'turkey, breast, meat only, roasted', 1, 0],
  // ── Fish ──
  ['salmon', 'Salmon (cooked)', 'Fish', 'fish, salmon, atlantic, farmed, cooked, dry heat', 1, 0],
  ['cod', 'Cod (cooked)', 'Fish', 'fish, cod, atlantic, cooked, dry heat', 1, 0],
  ['tuna-canned', 'Tuna (canned in water)', 'Fish', 'fish, tuna, light, canned in water, drained solids', 3, 0],
  ['tilapia', 'Tilapia (cooked)', 'Fish', 'fish, tilapia, cooked, dry heat', 1, 0],
  ['shrimp', 'Shrimp (cooked)', 'Fish', 'crustaceans, shrimp, cooked', 1, 0],
  ['sardines', 'Sardines (canned)', 'Fish', 'fish, sardine, atlantic, canned in oil, drained solids with bone', 3, 0],
  // ── Grain ──
  ['white-rice', 'White Rice (cooked)', 'Grain', 'rice, white, long-grain, regular, enriched, cooked', 1, 0],
  ['brown-rice', 'Brown Rice (cooked)', 'Grain', 'rice, brown, long-grain, cooked', 1, 0],
  ['quinoa', 'Quinoa (cooked)', 'Grain', 'quinoa, cooked', 1, 0],
  ['oats', 'Oats (dry)', 'Grain', 'oats, whole grain, rolled, old fashioned', 1, 0],
  ['pasta', 'Pasta (cooked)', 'Grain', 'pasta, cooked, enriched, without added salt', 3, 0],
  ['whole-wheat-bread', 'Whole Wheat Bread', 'Grain', 'bread, whole-wheat, commercially prepared', 3, 0],
  ['white-bread', 'White Bread', 'Grain', 'bread, white, commercially prepared', 4, 0],
  ['flour-tortilla', 'Flour Tortilla', 'Grain', 'tortillas, ready-to-bake or -fry, flour, refrigerated', 3, 0],
  ['couscous', 'Couscous (cooked)', 'Grain', 'couscous, cooked', 3, 0],
  ['bagel', 'Bagel (plain)', 'Grain', 'bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)', 3, 0],
  // ── Legume ──
  ['black-beans', 'Black Beans (cooked)', 'Legume', 'beans, black, mature seeds, cooked, boiled, without salt', 1, 100],
  ['chickpeas', 'Chickpeas (cooked)', 'Legume', 'chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt', 1, 100],
  ['lentils', 'Lentils (cooked)', 'Legume', 'lentils, mature seeds, cooked, boiled, without salt', 1, 100],
  ['kidney-beans', 'Kidney Beans (cooked)', 'Legume', 'beans, kidney, red, mature seeds, cooked, boiled, without salt', 1, 100],
  ['tofu', 'Tofu (firm)', 'Legume', 'tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)', 3, 100],
  ['edamame', 'Edamame', 'Legume', 'edamame, frozen, prepared', 1, 100],
  // ── Dairy & Eggs ──
  ['egg', 'Egg (whole)', 'Dairy & Eggs', 'egg, whole, raw, fresh', 1, 0],
  ['egg-white', 'Egg White', 'Dairy & Eggs', 'egg, white, raw, fresh', 1, 0],
  ['milk-2', 'Milk (2%)', 'Dairy & Eggs', 'milk, reduced fat, fluid, 2% milkfat, with added vitamin a and vitamin d', 1, 0],
  ['skim-milk', 'Skim Milk', 'Dairy & Eggs', 'milk, nonfat, fluid, with added vitamin a and vitamin d (fat free or skim)', 1, 0],
  ['greek-yogurt', 'Greek Yogurt (plain, nonfat)', 'Dairy & Eggs', 'yogurt, greek, plain, nonfat', 1, 0],
  ['cottage-cheese', 'Cottage Cheese', 'Dairy & Eggs', 'cheese, cottage, lowfat, 2% milkfat', 3, 0],
  ['cheddar-cheese', 'Cheddar Cheese', 'Dairy & Eggs', 'cheese, cheddar', 3, 0],
  ['mozzarella', 'Mozzarella', 'Dairy & Eggs', 'cheese, mozzarella, whole milk', 3, 0],
  ['butter', 'Butter', 'Dairy & Eggs', 'butter, salted', 2, 0],
  // ── Nuts & Fats ──
  ['almonds', 'Almonds', 'Nuts & Fats', 'nuts, almonds', 1, 100],
  ['walnuts', 'Walnuts', 'Nuts & Fats', 'nuts, walnuts, english', 1, 100],
  ['peanut-butter', 'Peanut Butter', 'Nuts & Fats', 'peanut butter, smooth style, with salt', 4, 100],
  ['olive-oil', 'Olive Oil', 'Nuts & Fats', 'oil, olive, salad or cooking', 2, 0],
  ['cashews', 'Cashews', 'Nuts & Fats', 'nuts, cashew nuts, raw', 1, 100],
  // ── Other ──
  ['honey', 'Honey', 'Other', 'honey', 2, 0],
  ['sugar', 'Sugar (white)', 'Other', 'sugars, granulated', 2, 0],
  ['dark-chocolate', 'Dark Chocolate (70%)', 'Other', 'chocolate, dark, 70-85% cacao solids', 4, 0],

  // ══ EXPANSION (added) ════════════════════════════════════════════════════════════
  // ── Fruit ──
  ['apricot', 'Apricot', 'Fruit', 'apricots, raw', 1, 100],
  ['nectarine', 'Nectarine', 'Fruit', 'nectarines, raw', 1, 100],
  ['mandarin', 'Mandarin Orange', 'Fruit', 'tangerines, (mandarin oranges), raw', 1, 100],
  ['honeydew', 'Honeydew Melon', 'Fruit', 'melons, honeydew, raw', 1, 100],
  ['papaya', 'Papaya', 'Fruit', 'papayas, raw', 1, 100],
  ['lime', 'Lime', 'Fruit', 'limes, raw', 1, 100],
  ['raisins', 'Raisins', 'Fruit', 'raisins, seedless', 1, 100],
  ['dates', 'Dates (Medjool)', 'Fruit', 'dates, medjool', 1, 100],
  ['dried-cranberries', 'Dried Cranberries', 'Fruit', 'cranberries, dried, sweetened', 2, 60],
  ['coconut', 'Coconut (raw)', 'Fruit', 'nuts, coconut meat, raw', 1, 100],
  ['plantain', 'Plantain (raw)', 'Fruit', 'plantains, raw', 1, 100],
  ['prunes', 'Prunes (dried plums)', 'Fruit', 'plums, dried (prunes), uncooked', 1, 100],
  // ── Vegetable ──
  ['beet', 'Beets', 'Vegetable', 'beets, raw', 1, 100],
  ['eggplant', 'Eggplant', 'Vegetable', 'eggplant, raw', 1, 100],
  ['butternut-squash', 'Butternut Squash', 'Vegetable', 'squash, winter, butternut, raw', 1, 100],
  ['spaghetti-squash', 'Spaghetti Squash', 'Vegetable', 'squash, winter, spaghetti, raw', 1, 100],
  ['pumpkin', 'Pumpkin', 'Vegetable', 'pumpkin, raw', 1, 100],
  ['green-onion', 'Green Onion (scallion)', 'Vegetable', 'onions, spring or scallions (includes tops and bulb), raw', 1, 100],
  ['leek', 'Leek', 'Vegetable', 'leeks, (bulb and lower leaf-portion), raw', 1, 100],
  ['radish', 'Radish', 'Vegetable', 'radishes, raw', 1, 100],
  ['arugula', 'Arugula', 'Vegetable', 'arugula, raw', 1, 100],
  ['collard-greens', 'Collard Greens', 'Vegetable', 'collards, raw', 1, 100],
  ['bok-choy', 'Bok Choy', 'Vegetable', 'cabbage, chinese (pak-choi), raw', 1, 100],
  ['jalapeno', 'Jalapeño', 'Vegetable', 'peppers, jalapeno, raw', 1, 100],
  ['green-bell-pepper', 'Green Bell Pepper', 'Vegetable', 'peppers, sweet, green, raw', 1, 100],
  ['snap-peas', 'Snap Peas', 'Vegetable', 'peas, edible-podded, raw', 1, 100],
  ['artichoke', 'Artichoke (cooked)', 'Vegetable', 'artichokes, (globe or french), cooked, boiled, drained, without salt', 1, 100],
  ['olives', 'Olives (ripe)', 'Vegetable', 'olives, ripe, canned (small-extra large)', 3, 100],
  ['pickles', 'Pickles (dill)', 'Vegetable', 'pickles, cucumber, dill or kosher dill', 3, 100],
  ['sun-dried-tomato', 'Sun-Dried Tomato', 'Vegetable', 'tomatoes, sun-dried', 1, 100],
  // ── Meat ──
  ['ground-chicken', 'Ground Chicken (cooked)', 'Meat', 'chicken, ground, crumbles, cooked, pan-browned', 1, 0],
  ['chicken-drumstick', 'Chicken Drumstick (cooked)', 'Meat', 'chicken, broilers or fryers, drumstick, meat only, cooked, roasted', 1, 0],
  ['chicken-wing', 'Chicken Wing (cooked)', 'Meat', 'chicken, broilers or fryers, wing, meat and skin, cooked, roasted', 1, 0],
  ['flank-steak', 'Flank Steak (cooked)', 'Meat', 'beef, flank, steak, separable lean only, trimmed to 0" fat, all grades, cooked, broiled', 1, 0],
  ['ny-strip', 'NY Strip Steak (cooked)', 'Meat', 'beef, short loin, top loin, separable lean only, trimmed to 1/8" fat, all grades, cooked, broiled', 1, 0],
  ['filet-mignon', 'Filet Mignon (cooked)', 'Meat', 'beef, tenderloin, steak, separable lean only, trimmed to 0" fat, all grades, cooked, broiled', 1, 0],
  ['ground-lamb', 'Ground Lamb (cooked)', 'Meat', 'lamb, ground, cooked, broiled', 1, 0],
  ['lamb-chop', 'Lamb Chop (cooked)', 'Meat', 'lamb, domestic, loin, separable lean only, trimmed to 1/4" fat, choice, cooked, broiled', 1, 0],
  ['italian-sausage', 'Italian Sausage (cooked)', 'Meat', 'sausage, italian, pork, cooked', 4, 0],
  ['breakfast-sausage', 'Breakfast Sausage (cooked)', 'Meat', 'sausage, pork, breakfast links, cooked', 4, 0],
  ['hot-dog', 'Hot Dog (beef)', 'Meat', 'frankfurter, beef, unheated', 4, 0],
  ['chorizo', 'Chorizo (cooked)', 'Meat', 'sausage, pork, chorizo, link or ground, cooked, pan-fried', 4, 0],
  ['pepperoni', 'Pepperoni', 'Meat', 'pepperoni, beef and pork, sliced', 4, 0],
  ['salami', 'Salami', 'Meat', 'salami, italian, pork', 4, 0],
  ['deli-turkey', 'Deli Turkey', 'Meat', 'turkey breast, low salt, prepackaged or deli, luncheon meat', 4, 0],
  // ── Fish ──
  ['tuna-steak', 'Tuna Steak (cooked)', 'Fish', 'fish, tuna, yellowfin, fresh, cooked, dry heat', 1, 0],
  ['halibut', 'Halibut (cooked)', 'Fish', 'fish, halibut, atlantic and pacific, cooked, dry heat', 1, 0],
  ['mahi-mahi', 'Mahi Mahi (cooked)', 'Fish', 'fish, mahimahi, cooked, dry heat', 1, 0],
  ['trout', 'Trout (cooked)', 'Fish', 'fish, trout, rainbow, farmed, cooked, dry heat', 1, 0],
  ['canned-salmon', 'Salmon (canned)', 'Fish', 'fish, salmon, pink, canned, drained solids without skin and bones', 3, 0],
  ['smoked-salmon', 'Smoked Salmon (lox)', 'Fish', 'fish, salmon, chinook, smoked', 4, 0],
  ['crab', 'Crab (cooked)', 'Fish', 'crustaceans, crab, blue, cooked, moist heat', 1, 0],
  ['lobster', 'Lobster (cooked)', 'Fish', 'crustaceans, lobster, northern, cooked, moist heat', 1, 0],
  ['scallops', 'Scallops (cooked)', 'Fish', 'mollusks, scallop, (bay and sea), cooked, steamed', 1, 0],
  ['mussels', 'Mussels (cooked)', 'Fish', 'mollusks, mussel, blue, cooked, moist heat', 1, 0],
  ['calamari', 'Calamari (squid, cooked)', 'Fish', 'mollusks, squid, mixed species, cooked, fried', 3, 0],
  ['anchovies', 'Anchovies (canned)', 'Fish', 'fish, anchovy, european, canned in oil, drained solids', 3, 0],
  // ── Grain ──
  ['sourdough-bread', 'Sourdough Bread', 'Grain', 'bread, french or vienna (includes sourdough)', 3, 0],
  ['rye-bread', 'Rye Bread', 'Grain', 'bread, rye', 3, 0],
  ['multigrain-bread', 'Multigrain Bread', 'Grain', 'bread, multi-grain (includes whole-grain)', 3, 0],
  ['english-muffin', 'English Muffin', 'Grain', 'english muffins, plain, enriched, with calcium propionate (includes sourdough)', 3, 0],
  ['pita', 'Pita Bread', 'Grain', 'bread, pita, white, enriched', 3, 0],
  ['naan', 'Naan', 'Grain', 'bread, naan, plain, commercially prepared, refrigerated', 3, 0],
  ['pancake', 'Pancake', 'Grain', 'pancakes, plain, prepared from recipe', 3, 0],
  ['waffle', 'Waffle', 'Grain', 'waffle, plain, frozen, ready-to-heat, toasted', 4, 0],
  ['granola', 'Granola', 'Grain', 'cereals ready-to-eat, granola, homemade', 3, 0],
  ['barley', 'Barley (cooked)', 'Grain', 'barley, pearled, cooked', 1, 0],
  ['farro', 'Farro (dry)', 'Grain', 'farro, pearled, dry, raw', 1, 0],
  ['popcorn', 'Popcorn (air-popped)', 'Grain', 'snacks, popcorn, air-popped', 3, 0],
  ['crackers', 'Crackers (saltine)', 'Grain', 'crackers, saltines (includes oyster, soda, soup)', 4, 0],
  ['rice-cakes', 'Rice Cakes', 'Grain', 'snacks, rice cakes, brown rice, plain', 3, 0],
  ['cornbread', 'Cornbread', 'Grain', 'bread, cornbread, prepared from recipe, made with low fat (2%) milk', 3, 0],
  // ── Legume ──
  ['pinto-beans', 'Pinto Beans (cooked)', 'Legume', 'beans, pinto, mature seeds, cooked, boiled, without salt', 1, 100],
  ['navy-beans', 'Navy Beans (cooked)', 'Legume', 'beans, navy, mature seeds, cooked, boiled, without salt', 1, 100],
  ['cannellini', 'Cannellini Beans (cooked)', 'Legume', 'beans, white, mature seeds, cooked, boiled, without salt', 1, 100],
  ['lima-beans', 'Lima Beans (cooked)', 'Legume', 'lima beans, large, mature seeds, cooked, boiled, without salt', 1, 100],
  ['black-eyed-peas', 'Black-Eyed Peas (cooked)', 'Legume', 'cowpeas, common (blackeyes, crowder, southern), mature seeds, cooked, boiled, without salt', 1, 100],
  ['hummus', 'Hummus', 'Legume', 'hummus, commercial', 3, 100],
  ['tempeh', 'Tempeh', 'Legume', 'tempeh', 3, 100],
  ['refried-beans', 'Refried Beans', 'Legume', 'beans, refried, canned, traditional style', 3, 100],
  ['peanuts', 'Peanuts (roasted)', 'Legume', 'peanuts, all types, dry-roasted, without salt', 1, 100],
  ['baked-beans', 'Baked Beans', 'Legume', 'beans, baked, canned, plain or vegetarian', 3, 60],
  // ── Dairy & Eggs ──
  ['whole-milk', 'Whole Milk', 'Dairy & Eggs', 'milk, whole, 3.25% milkfat, with added vitamin d', 1, 0],
  ['milk-1', 'Milk (1%)', 'Dairy & Eggs', 'milk, lowfat, fluid, 1% milkfat, with added vitamin a and vitamin d', 1, 0],
  ['heavy-cream', 'Heavy Cream', 'Dairy & Eggs', 'cream, fluid, heavy whipping', 3, 0],
  ['sour-cream', 'Sour Cream', 'Dairy & Eggs', 'cream, sour, cultured', 3, 0],
  ['cream-cheese', 'Cream Cheese', 'Dairy & Eggs', 'cheese, cream', 3, 0],
  ['ricotta', 'Ricotta', 'Dairy & Eggs', 'cheese, ricotta, whole milk', 3, 0],
  ['feta', 'Feta', 'Dairy & Eggs', 'cheese, feta', 3, 0],
  ['parmesan', 'Parmesan', 'Dairy & Eggs', 'cheese, parmesan, grated', 3, 0],
  ['swiss-cheese', 'Swiss Cheese', 'Dairy & Eggs', 'cheese, swiss', 3, 0],
  ['provolone', 'Provolone', 'Dairy & Eggs', 'cheese, provolone', 3, 0],
  ['american-cheese', 'American Cheese', 'Dairy & Eggs', 'cheese, pasteurized process, american, fortified with vitamin d', 4, 0],
  ['plain-yogurt', 'Plain Yogurt (whole milk)', 'Dairy & Eggs', 'yogurt, plain, whole milk', 1, 0],
  ['whole-greek-yogurt', 'Greek Yogurt (whole milk)', 'Dairy & Eggs', 'yogurt, greek, plain, whole milk', 1, 0],
  ['almond-milk', 'Almond Milk (unsweetened)', 'Dairy & Eggs', 'beverages, almond milk, unsweetened, shelf stable', 4, 0],
  ['oat-milk', 'Oat Milk (unsweetened)', 'Dairy & Eggs', 'oat milk, unsweetened, plain, refrigerated', 4, 0],
  ['soy-milk', 'Soy Milk (unsweetened)', 'Dairy & Eggs', 'soy milk, unsweetened, plain, shelf stable', 4, 0],
  // ── Nuts & Fats ──
  ['pistachios', 'Pistachios', 'Nuts & Fats', 'nuts, pistachio nuts, raw', 1, 100],
  ['pecans', 'Pecans', 'Nuts & Fats', 'nuts, pecans', 1, 100],
  ['hazelnuts', 'Hazelnuts', 'Nuts & Fats', 'nuts, hazelnuts or filberts', 1, 100],
  ['sunflower-seeds', 'Sunflower Seeds', 'Nuts & Fats', 'seeds, sunflower seed kernels, dried', 1, 100],
  ['pumpkin-seeds', 'Pumpkin Seeds (pepitas)', 'Nuts & Fats', 'seeds, pumpkin and squash seed kernels, dried', 1, 100],
  ['chia-seeds', 'Chia Seeds', 'Nuts & Fats', 'seeds, chia seeds, dried', 1, 100],
  ['flaxseed', 'Flaxseed (ground)', 'Nuts & Fats', 'seeds, flaxseed', 1, 100],
  ['almond-butter', 'Almond Butter', 'Nuts & Fats', 'almond butter, creamy', 3, 100],
  ['tahini', 'Tahini', 'Nuts & Fats', 'seeds, sesame butter, tahini, from roasted and toasted kernels', 3, 100],
  ['coconut-oil', 'Coconut Oil', 'Nuts & Fats', 'oil, coconut', 2, 0],
  ['canola-oil', 'Canola Oil', 'Nuts & Fats', 'oil, canola', 2, 0],
  ['avocado-oil', 'Avocado Oil', 'Nuts & Fats', 'oil, avocado', 2, 0],
  ['mayonnaise', 'Mayonnaise', 'Nuts & Fats', 'salad dressing, mayonnaise, regular', 4, 0],
  // ── Other ──
  ['maple-syrup', 'Maple Syrup', 'Other', 'syrups, maple', 2, 0],
  ['brown-sugar', 'Brown Sugar', 'Other', 'sugars, brown', 2, 0],
  ['jam', 'Jam / Preserves', 'Other', 'jams and preserves', 3, 0],
  ['ketchup', 'Ketchup', 'Other', 'catsup', 4, 0],
  ['mustard', 'Mustard', 'Other', 'mustard, prepared, yellow', 3, 0],
  ['soy-sauce', 'Soy Sauce', 'Other', 'soy sauce made from soy and wheat (shoyu)', 3, 0],
  ['salsa', 'Salsa', 'Other', 'sauce, salsa, ready-to-serve', 3, 80],
  ['marinara', 'Marinara Sauce', 'Other', 'sauce, pasta, spaghetti/marinara, ready-to-serve', 3, 80],
  ['ranch', 'Ranch Dressing', 'Other', 'salad dressing, ranch dressing, regular', 4, 0],
  ['bbq-sauce', 'BBQ Sauce', 'Other', 'sauce, barbecue', 4, 0],
  ['coconut-milk', 'Coconut Milk (canned)', 'Other', 'nuts, coconut milk, canned (liquid expressed from grated meat and water)', 3, 0],
  ['milk-chocolate', 'Milk Chocolate', 'Other', 'candies, milk chocolate', 4, 0],
].map(([slug, name, category, query, nova, fvp]) => ({ slug, name, category, query, nova, fvp }));

// ── FDC nutrient-id → output mapping (1xxx ids, same system foodSearch.ts uses) ───
// Core macros land in dedicated JSON columns; everything else becomes a micro in
// display units (mg / µg / g) matching NUTRIENT_DEFS in src/lib/offNutrients.ts.
const ENERGY_IDS = [1008, 2048, 2047]; // Energy (kcal), Atwater General, Atwater Specific
const MACROS = {
  protein: [1003],
  fat: [1004],
  carbs: [1005],
  fiber: [1079, 2033], // total dietary / AOAC 2011.25 (Foundation foods use 2033)
  sugar: [2000, 1063], // total sugars / total NLEA
  satFat: [1258],
};
const SODIUM_ID = 1093; // mg
// key → { ids, unit }. omega-3 is summed from its component fatty acids.
const MICROS = {
  // Minerals
  potassium: { ids: [1092], unit: 'mg' },
  calcium: { ids: [1087], unit: 'mg' },
  iron: { ids: [1089], unit: 'mg' },
  magnesium: { ids: [1090], unit: 'mg' },
  phosphorus: { ids: [1091], unit: 'mg' },
  zinc: { ids: [1095], unit: 'mg' },
  copper: { ids: [1098], unit: 'mg' },
  manganese: { ids: [1101], unit: 'mg' },
  selenium: { ids: [1103], unit: 'µg' },
  iodine: { ids: [1100], unit: 'µg' },
  // Vitamins
  'vitamin-c': { ids: [1162], unit: 'mg' },
  'vitamin-a': { ids: [1106], unit: 'µg' }, // RAE
  'vitamin-d': { ids: [1114], unit: 'µg', iuFallback: 1110 }, // D2+D3; IU/40 if needed
  'vitamin-e': { ids: [1109], unit: 'mg' }, // alpha-tocopherol
  'vitamin-k': { ids: [1185], unit: 'µg' }, // phylloquinone
  'beta-carotene': { ids: [1107], unit: 'µg' },
  'vitamin-b1': { ids: [1165], unit: 'mg' },
  'vitamin-b2': { ids: [1166], unit: 'mg' },
  'vitamin-pp': { ids: [1167], unit: 'mg' }, // niacin
  'vitamin-b6': { ids: [1175], unit: 'mg' },
  'vitamin-b9': { ids: [1177, 1190], unit: 'µg' }, // folate total / DFE
  'vitamin-b12': { ids: [1178], unit: 'µg' },
  'pantothenic-acid': { ids: [1170], unit: 'mg' },
  // Fats
  cholesterol: { ids: [1253], unit: 'mg' },
  'monounsaturated-fat': { ids: [1292], unit: 'g' },
  'polyunsaturated-fat': { ids: [1293], unit: 'g' },
  'trans-fat': { ids: [1257], unit: 'g' },
  'omega-3-fat': { ids: [1404, 1278, 1272, 1280], unit: 'g', sum: true }, // ALA+EPA+DHA+DPA
  'omega-6-fat': { ids: [1316, 1321], unit: 'g', sum: true }, // LA 18:2 n-6 + GLA 18:3 n-6
  // Carbohydrates (sugar breakdown + starch) — FDC lab-measured per sugar
  starch: { ids: [1009], unit: 'g' },
  fructose: { ids: [1012], unit: 'g' },
  glucose: { ids: [1011], unit: 'g' },
  sucrose: { ids: [1010], unit: 'g' },
  lactose: { ids: [1013], unit: 'g' },
  maltose: { ids: [1014], unit: 'g' },
  // Fiber fractions (sparse in FDC, but shown when present)
  'soluble-fiber': { ids: [1082], unit: 'g' },
  'insoluble-fiber': { ids: [1084], unit: 'g' },
};

// ── Household portions (discrete items only) ──────────────────────────────────────
// Curated from each food's USDA `foodPortions` (Small/Medium/Large/slice/each — the
// natural units people log). Amorphous foods (rice, ground beef, oils) are omitted —
// they stay g/oz. Values are the lab record's gram weights; `apple` is sourced from
// the SR-Legacy apple (#171688) since our Foundation gala pin only carries an RACC.
// Tapped in the quantity sheet to fill the gram amount.
const PORTIONS = {
  // ── Fruit ── (S/M/L for discrete fruit; cup/handful for berries; ½/whole for big)
  apple: [['Small', 149], ['Medium', 182], ['Large', 223]],
  banana: [['Small', 101], ['Medium', 118], ['Large', 136]],
  orange: [['Small', 96], ['Medium', 131], ['Large', 184]],
  peach: [['Small', 130], ['Medium', 150], ['Large', 175]],
  pear: [['Small', 148], ['Medium', 178], ['Large', 230]],
  plum: [['Each', 66]],
  grapefruit: [['½ fruit', 123], ['Whole', 246]],
  lemon: [['Each', 58]],
  apricot: [['Each', 35], ['Cup', 165]],
  nectarine: [['Small', 129], ['Medium', 142], ['Large', 156]],
  mandarin: [['Small', 76], ['Medium', 88], ['Large', 120]],
  honeydew: [['Cup', 170]],
  papaya: [['Cup', 145], ['Small fruit', 157]],
  lime: [['Each', 67]],
  strawberries: [['Cup', 144]],
  blueberries: [['Handful', 68], ['Cup', 148]],
  raspberries: [['Cup', 123]],
  blackberries: [['Cup', 144]],
  grapes: [['10 grapes', 49], ['Cup', 151]],
  cherries: [['10 cherries', 82], ['Cup', 138]],
  watermelon: [['Cup', 152], ['Wedge', 286]],
  cantaloupe: [['Wedge', 69], ['Cup', 160]],
  pineapple: [['Slice', 84], ['Cup', 165]],
  mango: [['½ mango', 103], ['Cup', 165]],
  kiwi: [['Each', 69]],
  pomegranate: [['Cup arils', 87], ['Whole', 282]],
  avocado: [['½', 100], ['Whole', 201]],
  raisins: [['1 tbsp', 9], ['Small box', 43]],
  dates: [['Each', 24]],
  'dried-cranberries': [['1 oz', 28], ['¼ cup', 40]],
  coconut: [['Cup shredded', 80]],
  plantain: [['½', 134], ['Whole', 267]],
  prunes: [['Each', 8], ['¼ cup', 44]],
  // ── Vegetable ──
  carrot: [['Small', 50], ['Medium', 61], ['Large', 72]],
  tomato: [['Small', 91], ['Medium', 123], ['Large', 182]],
  potato: [['Small', 125], ['Medium', 167], ['Large', 300]],
  'sweet-potato': [['Small', 60], ['Medium', 114], ['Large', 180]],
  'bell-pepper': [['Small', 74], ['Medium', 119], ['Large', 164]],
  'green-bell-pepper': [['Small', 74], ['Medium', 119], ['Large', 164]],
  onion: [['Small', 70], ['Medium', 110], ['Large', 150]],
  corn: [['Small ear', 73], ['Medium ear', 102], ['Large ear', 143]],
  zucchini: [['Small', 118], ['Medium', 196], ['Large', 323]],
  broccoli: [['Cup', 91]],
  spinach: [['Cup', 30]],
  kale: [['Cup', 21]],
  lettuce: [['Cup', 47]],
  cucumber: [['Cup sliced', 52], ['Whole', 301]],
  garlic: [['Clove', 3]],
  cauliflower: [['Cup', 107]],
  'green-beans': [['Cup', 100]],
  asparagus: [['Spear', 16], ['Cup', 134]],
  mushroom: [['Small', 10], ['Medium', 18], ['Large', 23]],
  celery: [['Small stalk', 17], ['Medium stalk', 40], ['Large stalk', 64]],
  peas: [['Cup', 145]],
  'brussels-sprouts': [['Each', 19], ['Cup', 88]],
  cabbage: [['Cup', 89]],
  beet: [['Each', 82], ['Cup', 136]],
  eggplant: [['Cup', 82]],
  'butternut-squash': [['Cup', 140]],
  'spaghetti-squash': [['Cup', 101]],
  pumpkin: [['Cup', 116]],
  'green-onion': [['Each', 15], ['Tbsp', 6]],
  leek: [['Each', 89]],
  radish: [['Each', 4.5], ['Cup', 116]],
  arugula: [['Cup', 10]],
  'collard-greens': [['Cup', 36]],
  'bok-choy': [['Cup', 70]],
  jalapeno: [['Each', 14]],
  'snap-peas': [['Cup', 63]],
  artichoke: [['Each', 120]],
  olives: [['Each', 4], ['Tbsp', 8]],
  pickles: [['Spear', 35], ['Slice', 7]],
  'sun-dried-tomato': [['Piece', 2], ['Cup', 54]],
  // ── Meat (3 oz cooked = palm/deck of cards) ──
  'chicken-breast': [['3 oz', 85], ['Cup diced', 140]],
  'chicken-thigh': [['3 oz', 85], ['Thigh', 116]],
  'ground-beef-80-20': [['3 oz', 85]],
  'ground-beef-90-10': [['3 oz', 85]],
  'ground-beef-93-7': [['3 oz', 85]],
  'beef-sirloin': [['3 oz', 85]],
  'ribeye-steak': [['3 oz', 85]],
  'pork-chop': [['3 oz', 85], ['Chop', 146]],
  'pork-tenderloin': [['3 oz', 85]],
  bacon: [['Slice', 11], ['3 slices', 34]],
  ham: [['Slice', 28], ['3 oz', 85]],
  'ground-turkey': [['3 oz', 85]],
  'turkey-breast': [['3 oz', 85]],
  'ground-chicken': [['3 oz', 85]],
  'chicken-drumstick': [['Drumstick', 96], ['3 oz', 85]],
  'chicken-wing': [['3 oz', 85]],
  'flank-steak': [['3 oz', 85]],
  'ny-strip': [['3 oz', 85]],
  'filet-mignon': [['3 oz', 85]],
  'ground-lamb': [['3 oz', 85]],
  'lamb-chop': [['3 oz', 85]],
  'italian-sausage': [['Link', 87], ['3 oz', 85]],
  'breakfast-sausage': [['2 links', 45]],
  'hot-dog': [['Each', 52]],
  chorizo: [['3 oz', 85]],
  pepperoni: [['5 slices', 11], ['1 oz', 28]],
  salami: [['Slice', 10], ['1 oz', 28]],
  'deli-turkey': [['Slice', 28], ['2 oz', 57]],
  // ── Fish (3 oz cooked) ──
  salmon: [['3 oz', 85], ['Fillet', 178]],
  cod: [['3 oz', 85], ['Fillet', 180]],
  'tuna-canned': [['3 oz', 85], ['Can', 165]],
  tilapia: [['3 oz', 85], ['Fillet', 87]],
  shrimp: [['3 oz', 85]],
  sardines: [['Can', 92], ['3 oz', 85]],
  'tuna-steak': [['3 oz', 85]],
  halibut: [['3 oz', 85], ['Fillet', 159]],
  'mahi-mahi': [['3 oz', 85], ['Fillet', 159]],
  trout: [['3 oz', 85], ['Fillet', 71]],
  'canned-salmon': [['3 oz', 85], ['Can', 165]],
  'smoked-salmon': [['1 oz', 28], ['3 oz', 85]],
  crab: [['3 oz', 85], ['Cup', 118]],
  lobster: [['3 oz', 85], ['Cup', 145]],
  scallops: [['3 oz', 85]],
  mussels: [['3 oz', 85]],
  calamari: [['3 oz', 85]],
  anchovies: [['Each', 4], ['Can', 45]],
  // ── Grain ──
  'white-rice': [['½ cup', 79], ['1 cup', 158]],
  'brown-rice': [['½ cup', 101], ['1 cup', 202]],
  quinoa: [['½ cup', 93], ['1 cup', 185]],
  oats: [['½ cup dry', 40], ['1 cup dry', 81]],
  pasta: [['1 cup', 124]],
  'whole-wheat-bread': [['Slice', 32]],
  'white-bread': [['Slice', 29]],
  'flour-tortilla': [['Each', 30]],
  couscous: [['1 cup', 157]],
  bagel: [['Small', 69], ['Medium', 105], ['Large', 131]],
  'sourdough-bread': [['Slice', 48]],
  'rye-bread': [['Slice', 32]],
  'multigrain-bread': [['Slice', 26]],
  'english-muffin': [['Each', 57]],
  pita: [['Small', 28], ['Large', 60]],
  naan: [['Each', 90]],
  pancake: [['Small', 38], ['Large', 77]],
  waffle: [['Each', 33]],
  granola: [['¼ cup', 30], ['½ cup', 61]],
  barley: [['½ cup', 79], ['1 cup', 157]],
  farro: [['¼ cup dry', 45]],
  popcorn: [['1 cup', 8], ['3 cups', 24]],
  crackers: [['5 crackers', 15]],
  'rice-cakes': [['Each', 9]],
  cornbread: [['Piece', 65]],
  // ── Legume ──
  'black-beans': [['½ cup', 86], ['1 cup', 172]],
  chickpeas: [['½ cup', 82], ['1 cup', 164]],
  lentils: [['½ cup', 99], ['1 cup', 198]],
  'kidney-beans': [['½ cup', 89], ['1 cup', 177]],
  tofu: [['½ cup', 63], ['Cup', 126]],
  edamame: [['½ cup', 78], ['1 cup', 155]],
  'pinto-beans': [['½ cup', 86], ['1 cup', 171]],
  'navy-beans': [['½ cup', 91], ['1 cup', 182]],
  cannellini: [['½ cup', 90], ['1 cup', 179]],
  'lima-beans': [['½ cup', 94], ['1 cup', 188]],
  'black-eyed-peas': [['½ cup', 86], ['1 cup', 171]],
  hummus: [['2 tbsp', 30], ['¼ cup', 62]],
  tempeh: [['½ cup', 83], ['1 cup', 166]],
  'refried-beans': [['½ cup', 119], ['1 cup', 238]],
  peanuts: [['1 oz', 28], ['¼ cup', 37]],
  'baked-beans': [['½ cup', 127], ['1 cup', 254]],
  // ── Dairy & Eggs ──
  egg: [['Small', 38], ['Medium', 44], ['Large', 50], ['X-Large', 56]],
  'egg-white': [['1 white', 33]],
  'milk-2': [['½ cup', 122], ['Cup', 244]],
  'skim-milk': [['Cup', 245]],
  'whole-milk': [['Cup', 244]],
  'milk-1': [['Cup', 244]],
  'greek-yogurt': [['Container', 170], ['Cup', 245]],
  'whole-greek-yogurt': [['Container', 170]],
  'plain-yogurt': [['Container', 170], ['Cup', 245]],
  'cottage-cheese': [['½ cup', 113], ['Cup', 226]],
  'cheddar-cheese': [['Slice', 28], ['Cup shredded', 113]],
  mozzarella: [['1 oz', 28], ['Cup shredded', 112]],
  butter: [['Pat', 5], ['Tbsp', 14], ['Stick', 113]],
  'heavy-cream': [['Tbsp', 15], ['Cup', 238]],
  'sour-cream': [['Tbsp', 12], ['Cup', 230]],
  'cream-cheese': [['Tbsp', 15], ['1 oz', 28]],
  ricotta: [['¼ cup', 62], ['½ cup', 124]],
  feta: [['1 oz', 28], ['¼ cup', 38]],
  parmesan: [['Tbsp', 5], ['1 oz', 28]],
  'swiss-cheese': [['Slice', 28]],
  provolone: [['Slice', 28]],
  'american-cheese': [['Slice', 21], ['1 oz', 28]],
  'almond-milk': [['Cup', 244]],
  'oat-milk': [['Cup', 244]],
  'soy-milk': [['Cup', 243]],
  // ── Nuts & Fats ──
  almonds: [['1 oz (23)', 28], ['Cup', 143]],
  walnuts: [['1 oz (14)', 28], ['Cup', 117]],
  cashews: [['1 oz', 28], ['Cup', 137]],
  'peanut-butter': [['1 tbsp', 16], ['2 tbsp', 32]],
  'olive-oil': [['1 tsp', 4.5], ['1 tbsp', 13.5]],
  pistachios: [['1 oz (49)', 28], ['Cup', 123]],
  pecans: [['1 oz (19)', 28], ['Cup', 109]],
  hazelnuts: [['1 oz', 28], ['Cup', 135]],
  'sunflower-seeds': [['1 oz', 28], ['¼ cup', 35]],
  'pumpkin-seeds': [['1 oz', 28], ['¼ cup', 32]],
  'chia-seeds': [['1 tbsp', 12], ['1 oz', 28]],
  flaxseed: [['1 tbsp', 7], ['2 tbsp', 14]],
  'almond-butter': [['1 tbsp', 16], ['2 tbsp', 32]],
  tahini: [['1 tbsp', 15], ['2 tbsp', 30]],
  'coconut-oil': [['1 tsp', 4.5], ['1 tbsp', 13.6]],
  'canola-oil': [['1 tsp', 4.5], ['1 tbsp', 14]],
  'avocado-oil': [['1 tsp', 4.5], ['1 tbsp', 14]],
  mayonnaise: [['1 tbsp', 14], ['1 packet', 10]],
  // ── Other ──
  honey: [['1 tsp', 7], ['1 tbsp', 21]],
  sugar: [['1 tsp', 4], ['1 tbsp', 12.5]],
  'dark-chocolate': [['1 oz', 28], ['Bar', 44]],
  'maple-syrup': [['1 tbsp', 20], ['¼ cup', 83]],
  'brown-sugar': [['1 tsp', 4.6], ['1 tbsp', 14]],
  jam: [['1 tbsp', 20]],
  ketchup: [['1 tbsp', 17], ['1 packet', 9]],
  mustard: [['1 tsp', 5], ['1 tbsp', 15]],
  'soy-sauce': [['1 tsp', 5], ['1 tbsp', 16]],
  salsa: [['2 tbsp', 36], ['¼ cup', 60]],
  marinara: [['½ cup', 132]],
  ranch: [['1 tbsp', 15], ['2 tbsp', 30]],
  'bbq-sauce': [['1 tbsp', 17], ['2 tbsp', 34]],
  'coconut-milk': [['1 tbsp', 15], ['¼ cup', 57]],
  'milk-chocolate': [['1 oz', 28], ['Bar', 44]],
};
const portionsFor = (slug) =>
  PORTIONS[slug]?.map(([label, grams]) => ({ label, grams })) ?? null;

// ── Unit conversion → display unit (g / mg / µg) ──────────────────────────────────
const toGrams = (amount, unit) => {
  // Normalize both micro-sign codepoints (U+00B5 µ, U+03BC μ) to 'u' — `.toUpperCase()`
  // would map U+00B5 to Greek capital Mu, so a naive `case 'µG'` silently misses
  // every microgram nutrient (vit A/D/K/B9/B12, selenium, beta-carotene, iodine).
  const u = (unit || '').toLowerCase().replace(/[µμ]/g, 'u');
  switch (u) {
    case 'g': return amount;
    case 'mg': return amount / 1e3;
    case 'ug': case 'mcg': return amount / 1e6;
    default: return null; // kcal/kj/iu handled separately
  }
};
const fromGrams = (g, displayUnit) =>
  displayUnit === 'g' ? g : displayUnit === 'mg' ? g * 1e3 : g * 1e6; // µg
const convert = (amount, fromUnit, displayUnit) => {
  const g = toGrams(amount, fromUnit);
  return g == null ? null : fromGrams(g, displayUnit);
};

// ── Rounding (keeps the JSON tidy + diff-friendly) ────────────────────────────────
const r1 = (n) => Math.round(n * 10) / 10;
const roundMicro = (n) => (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100);

// ── Nutri-Score 2023 (general solid-food algorithm) — ported from the old script ──
const pts = (value, thresholds) => {
  for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i;
  return thresholds.length;
};
function nutriScore(kcal, sugar, satfat, sodiumMg, fiber, protein, fvp) {
  const energyKj = kcal * 4.184;
  const salt = (sodiumMg * 2.5) / 1000; // sodium(mg) → salt(g)
  const nEnergy = pts(energyKj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]);
  const nSugar = pts(sugar, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51]);
  const nSatfat = pts(satfat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const nSalt = pts(salt, [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0]);
  const N = nEnergy + nSugar + nSatfat + nSalt;
  const pFiber = pts(fiber, [3.0, 4.1, 5.2, 6.3, 7.4]);
  const pProtein = pts(protein, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  const pFvp = fvp <= 40 ? 0 : fvp <= 60 ? 1 : fvp <= 80 ? 2 : 5;
  // Protein only counts when N < 11, unless fruit/veg already maxed.
  const P = pFiber + pFvp + (N < 11 || pFvp === 5 ? pProtein : 0);
  const score = N - P;
  if (score <= 0) return 'a';
  if (score <= 2) return 'b';
  if (score <= 10) return 'c';
  if (score <= 18) return 'd';
  return 'e';
}

// ── FDC API ───────────────────────────────────────────────────────────────────────
const FDC = 'https://api.nal.usda.gov/fdc/v1';
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fdcFetch(url, init, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, init);
      // Retry 404 too: the /food/{id} detail endpoint transiently 404s on some
      // (older Foundation) ids that exist — search never 404s, so this is safe.
      if (res.status === 429 || res.status === 404 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return res.json();
    } catch (e) {
      if (attempt === tries) throw e;
      await sleep(attempt * 800); // backoff
    }
  }
}

/** Resolve a query to a single FDC record: prefer Foundation/SR Legacy, best token overlap. */
async function resolveFdcId(query) {
  const tryTypes = [['Foundation', 'SR Legacy'], ['Survey (FNDDS)']];
  const wanted = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  for (const dataType of tryTypes) {
    const data = await fdcFetch(`${FDC}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, dataType, pageSize: 15, requireAllWords: false }),
    });
    const foods = data?.foods ?? [];
    if (!foods.length) continue;
    // Rank by how many query tokens appear in the description (FDC relevance is uneven).
    const score = (desc) => {
      const d = (desc || '').toLowerCase();
      let s = 0;
      for (const w of wanted) if (d.includes(w)) s++;
      return s;
    };
    foods.sort((a, b) => score(b.description) - score(a.description));
    const best = foods[0];
    return { fdcId: best.fdcId, description: best.description, dataType: best.dataType };
  }
  return null;
}

/** Fetch the full food record and normalize its nutrients to { id, amount, unit }. */
async function getFoodNutrients(fdcId) {
  const data = await fdcFetch(`${FDC}/food/${fdcId}?api_key=${API_KEY}&format=full`);
  const list = (data?.foodNutrients ?? [])
    .map((fn) => ({
      id: fn?.nutrient?.id,
      amount: typeof fn?.amount === 'number' ? fn.amount : null,
      unit: fn?.nutrient?.unitName,
    }))
    .filter((n) => n.id != null && n.amount != null);
  return { description: data?.description, list };
}

const findById = (list, id) => list.find((n) => n.id === id);
function pickMacro(list, ids) {
  for (const id of ids) {
    const n = findById(list, id);
    if (n) return n.amount;
  }
  return null;
}
function pickEnergyKcal(list) {
  for (const id of ENERGY_IDS) {
    const n = findById(list, id);
    if (!n) continue;
    const u = (n.unit || '').toUpperCase();
    if (u === 'KJ') return n.amount / 4.184;
    return n.amount; // KCAL
  }
  return null;
}
function pickMicro(list, def) {
  if (def.sum) {
    let total = 0, any = false;
    for (const id of def.ids) {
      const n = findById(list, id);
      if (n) { const v = convert(n.amount, n.unit, def.unit); if (v != null) { total += v; any = true; } }
    }
    return any ? total : null;
  }
  for (const id of def.ids) {
    const n = findById(list, id);
    if (n) { const v = convert(n.amount, n.unit, def.unit); if (v != null) return v; }
  }
  if (def.iuFallback) {
    const n = findById(list, def.iuFallback);
    if (n && (n.unit || '').toUpperCase() === 'IU') return n.amount / 40; // IU → µg (vit D)
  }
  return null;
}

/** Build a finished base-food entry from a fetched FDC nutrient list. */
function buildEntry(cfg, fdcId, list) {
  const calories = pickEnergyKcal(list);
  const macro = {};
  for (const [k, ids] of Object.entries(MACROS)) macro[k] = pickMacro(list, ids) ?? 0;
  // Foundation records sometimes omit the total-sugars rollup but list the
  // individual sugars — sum them so the core `sugar` column isn't left at 0.
  if (!macro.sugar) {
    let s = 0, any = false;
    for (const id of [1010, 1011, 1012, 1013, 1014]) { // sucrose/glucose/fructose/lactose/maltose
      const n = findById(list, id);
      if (n) { s += n.amount; any = true; }
    }
    if (any) macro.sugar = s;
  }
  const sodium = findById(list, SODIUM_ID)?.amount ?? 0; // mg

  const micros = {};
  for (const [key, def] of Object.entries(MICROS)) {
    const v = pickMicro(list, def);
    if (v != null) { const rv = roundMicro(v); if (rv > 0) micros[key] = rv; }
  }

  // Pure added fats/oils break the general solid-food Nutri-Score (olive oil → E), so leave them ungraded.
  const ungraded = cfg.slug === 'olive-oil' || cfg.slug === 'butter';
  const ns = ungraded
    ? null
    : nutriScore(calories ?? 0, macro.sugar, macro.satFat, sodium, macro.fiber, macro.protein, cfg.fvp);

  const missing = [];
  if (calories == null) missing.push('calories');
  for (const k of Object.keys(MACROS)) if (findById(list, MACROS[k][0]) == null && macro[k] === 0) missing.push(k);

  return {
    entry: {
      slug: cfg.slug,
      name: cfg.name,
      category: cfg.category,
      fdcId,
      calories: calories != null ? Math.round(calories) : 0,
      protein: r1(macro.protein),
      carbs: r1(macro.carbs),
      fat: r1(macro.fat),
      fiber: r1(macro.fiber),
      sugar: r1(macro.sugar),
      satFat: r1(macro.satFat),
      sodium: Math.round(sodium),
      nova: cfg.nova,
      fruitVegPct: cfg.fvp,
      nutriScore: ns,
      micros,
      ...(portionsFor(cfg.slug) ? { portions: portionsFor(cfg.slug) } : {}),
    },
    missing,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────────
function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

async function main() {
  if (!API_KEY) {
    console.error('Missing FDC API key. Set FDC_API_KEY=... (free: https://fdc.nal.usda.gov/api-key-signup.html)\n' +
      'or pass --api-key=...');
    process.exit(1);
  }
  const mode = WRITE ? 'WRITE base-ingredients.json' : WRITE_LOCK ? 'WRITE-LOCK only' : 'DRY-RUN (no files written)';
  console.log(`FDC base-foods pull — ${mode}${RELOCK ? ' [--relock]' : ''}\n`);

  const lock = RELOCK ? {} : loadJson(LOCK, {});
  const existing = loadJson(OUT, []);
  const existingBySlug = Object.fromEntries(existing.map((f) => [f.slug, f]));

  const out = [];
  const failures = [];
  const newlyResolved = [];
  let needLockWrite = false;

  for (const cfg of CONFIG) {
    try {
      let pin = lock[cfg.slug];
      if (!pin?.fdcId) {
        const r = await resolveFdcId(cfg.query);
        if (!r) throw new Error('no FDC match');
        pin = { fdcId: r.fdcId, description: r.description, dataType: r.dataType };
        lock[cfg.slug] = pin;
        newlyResolved.push(cfg.slug);
        needLockWrite = true;
        await sleep(120);
      }
      const { description, list } = await getFoodNutrients(pin.fdcId);
      if (!pin.description) { pin.description = description; needLockWrite = true; }
      const { entry, missing } = buildEntry(cfg, pin.fdcId, list);
      out.push(entry);
      const warn = missing.length ? `  ⚠ missing: ${missing.join(', ')}` : '';
      console.log(`✓ ${cfg.slug.padEnd(20)} #${String(pin.fdcId).padEnd(8)} ${entry.calories}kcal P${entry.protein} C${entry.carbs} F${entry.fat}  | ${pin.description}${warn}`);
      await sleep(120);
    } catch (e) {
      failures.push({ slug: cfg.slug, error: String(e?.message || e) });
      const kept = existingBySlug[cfg.slug];
      if (kept) out.push(kept); // preserve old values — never drop a food
      console.log(`✗ ${cfg.slug.padEnd(20)} ${kept ? '(kept existing)' : '(NO DATA)'}  — ${e?.message || e}`);
    }
  }

  // Keep CONFIG order for a stable, reviewable diff.
  const order = Object.fromEntries(CONFIG.map((c, i) => [c.slug, i]));
  out.sort((a, b) => (order[a.slug] ?? 999) - (order[b.slug] ?? 999));

  console.log(`\nResolved ${out.length - failures.filter((f) => !existingBySlug[f.slug]).length}/${CONFIG.length} foods.`);
  if (newlyResolved.length) console.log(`Newly resolved (audit these in the lockfile): ${newlyResolved.join(', ')}`);
  if (failures.length) console.log(`Failures: ${failures.map((f) => f.slug).join(', ')}`);
  const nsSpread = out.reduce((m, f) => ((m[f.nutriScore || '—'] = (m[f.nutriScore || '—'] || 0) + 1), m), {});
  console.log('Nutri-Score spread:', nsSpread);

  if ((WRITE_LOCK || WRITE) && needLockWrite) {
    fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
    console.log(`\nWrote lockfile → ${path.relative(ROOT, LOCK)} (review the descriptions!)`);
  }
  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
    console.log(`Wrote ${out.length} foods → ${path.relative(ROOT, OUT)}`);
    console.log('→ Now bump BASE_FOODS_VERSION in src/lib/baseFoodsSeed.ts so installs re-seed.');
  } else if (!WRITE_LOCK) {
    console.log('\nDry-run only. Re-run with --write-lock (audit) then --write to apply.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
