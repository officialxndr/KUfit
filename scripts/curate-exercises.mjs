/**
 * Apply the curation pass (scripts/lib-curate.mjs) to the committed catalog.json.
 *
 *   node scripts/curate-exercises.mjs           # dry run — print the report only
 *   node scripts/curate-exercises.mjs --write   # rewrite assets/exercises/catalog.json
 *
 * Re-running is safe/idempotent. `seed-exercises.mjs` also calls curate() after a
 * fresh fetch, so regenerating the catalog from the API stays clean too.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { curate } from './lib-curate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'assets', 'exercises', 'catalog.json');
const write = process.argv.includes('--write');

const raw = JSON.parse(await readFile(CATALOG, 'utf8'));
const { list, report } = curate(raw);

console.log('=== curation report ===');
console.table(report);

const byEq = {};
for (const e of list) byEq[e.equipment] = (byEq[e.equipment] || 0) + 1;
console.log('\n=== final equipment counts ===');
Object.entries(byEq).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(5), k));

if (write) {
  await writeFile(CATALOG, JSON.stringify(list, null, 2));
  console.log(`\nWrote ${list.length} exercises → assets/exercises/catalog.json`);
} else {
  console.log('\n(dry run — pass --write to apply)');
}
