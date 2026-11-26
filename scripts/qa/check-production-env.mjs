// Release gate: a production build must not target the isolated test project.
//
// The Render deployment currently compiles the isolated ref into the bundle,
// which is why real accounts cannot sign in there. Run after `npm run build`:
//   GEEGLE_EXPECT_PRODUCTION=1 node scripts/qa/check-production-env.mjs
// Exits 1 when the built bundle contains the isolated project reference.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ISOLATED_REF = 'wkdlsaydqyymynoipmhl';
const INTENDED_REF = process.env.GEEGLE_INTENDED_SUPABASE_REF ?? 'oizdbkxnzwatytxcrvoo';
const required = process.env.GEEGLE_EXPECT_PRODUCTION === '1';
const assets = join(process.cwd(), 'dist', 'assets');
let files = [];
try {
  files = readdirSync(assets).filter((name) => name.endsWith('.js'));
} catch {
  console.error('No dist/assets build found. Run `npm run build` first.');
  process.exit(2);
}

const hits = files.filter((name) => readFileSync(join(assets, name), 'utf8').includes(ISOLATED_REF));
const intended = files.some((name) => readFileSync(join(assets, name), 'utf8').includes(INTENDED_REF));

if (hits.length) {
  console.error(`FAIL production build targets isolated Supabase project ${ISOLATED_REF} (${hits.join(', ')}).`);
  console.error(`Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to the intended project (${INTENDED_REF}) and rebuild.`);
  process.exit(required ? 1 : 0);
}

console.log(`PASS production build does not reference the isolated project${intended ? `; intended ref ${INTENDED_REF} present` : ''}.`);
