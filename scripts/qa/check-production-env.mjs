// Release gate for a production build. Run after `npm run build`:
//
//   GEEGLE_EXPECT_PRODUCTION=1 node scripts/qa/check-production-env.mjs
//
// The Procfile runs it on every Render deploy, between the build and the static
// server, so a misconfigured bundle never replaces the working deployment.
// It inspects the built artifact (dist/assets/*.js), not the source env vars,
// because those are baked in at build time.
//
// Checks, in order:
//   1. no isolated test-project reference in the bundle
//   2. no placeholder configuration compiled in
//   3. the intended project URL is present
//   4. a public key is present and belongs to a project that accepts it
//   5. no service-role key is anywhere in the bundle
//
// Exit codes: 0 pass, 1 fail, 2 cannot evaluate (no build).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ISOLATED_REF = 'wkdlsaydqyymynoipmhl';
const INTENDED_REF = process.env.GEEGLE_INTENDED_SUPABASE_REF ?? 'oizdbkxnzwatytxcrvoo';
const required = process.env.GEEGLE_EXPECT_PRODUCTION === '1';
const assetsDir = join(process.cwd(), 'dist', 'assets');

function fail(message, hint) {
  console.error(`FAIL ${message}`);
  if (hint) console.error(`     ${hint}`);
  process.exit(required ? 1 : 0);
}

let files = [];
try {
  files = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
} catch {
  console.error('No dist/assets build found. Run `npm run build` first.');
  process.exit(2);
}
if (files.length === 0) {
  console.error('dist/assets contains no JavaScript bundles.');
  process.exit(2);
}

const bundle = files.map((name) => readFileSync(join(assetsDir, name), 'utf8')).join('\n');

// 1. Isolated test project must never ship.
const isolatedHits = files.filter((name) =>
  readFileSync(join(assetsDir, name), 'utf8').includes(ISOLATED_REF)
);
if (isolatedHits.length > 0) {
  fail(
    `the build targets the isolated test project ${ISOLATED_REF} (${isolatedHits.join(', ')})`,
    `Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to the intended project (${INTENDED_REF}) and rebuild.`
  );
}

// 2. Placeholder configuration means the variables were missing at build time.
if (bundle.includes('placeholder.invalid') || bundle.includes('placeholder-anon-key')) {
  fail(
    'Supabase configuration was missing at build time (placeholder values compiled in)',
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the production service, then rebuild.'
  );
}

// 3. The intended project must actually be the one compiled in.
const urls = [...new Set(bundle.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/g) ?? [])];
if (urls.length === 0) {
  fail('no Supabase project URL found in the build', 'VITE_SUPABASE_URL was empty or invalid.');
}
if (!urls.some((url) => url.includes(INTENDED_REF))) {
  fail(
    `the build targets ${urls.join(', ')}, not the intended project ${INTENDED_REF}`,
    'Correct VITE_SUPABASE_URL on the production service and rebuild.'
  );
}

// 4. A public key must be present.
const publishableKey = (bundle.match(/sb_publishable_[A-Za-z0-9_-]+/) ?? [])[0];
const legacyAnonKey = (bundle.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) ?? [])[0];
const publicKey = publishableKey ?? legacyAnonKey;
if (!publicKey) {
  fail('no Supabase public key found in the build', 'VITE_SUPABASE_ANON_KEY was empty.');
}

// 5. A service-role or secret key must never reach a public bundle.
function jwtRole(key) {
  try {
    const payload = key.split('.')[1];
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}
const leaked = [...new Set(bundle.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [])]
  .map((key) => jwtRole(key))
  .filter((role) => role === 'service_role' || role === 'supabase_admin');
if (leaked.length > 0) {
  fail(
    `the bundle contains a privileged Supabase key (${leaked.join(', ')})`,
    'Only the publishable/anon key may be exposed. Rotate the secret key immediately.'
  );
}

// 6. The key must belong to the project the bundle points at. Only a matching
//    project answers /auth/v1/settings with 200 for this key.
async function probe(url, key) {
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10_000),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    /* non-JSON reply still tells us the key was rejected */
  }
  return { status: response.status, body };
}

let settings;
try {
  settings = await probe(`https://${INTENDED_REF}.supabase.co`, publicKey);
} catch (error) {
  fail(
    `could not reach the intended project to validate the key (${error.message})`,
    'The deployment cannot be validated while the auth endpoint is unreachable.'
  );
}
if (settings.status !== 200) {
  fail(
    `the public key does not belong to ${INTENDED_REF} (auth settings returned ${settings.status})`,
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must come from the same project.'
  );
}

console.log(
  `PASS production build targets ${INTENDED_REF}, the public key is accepted by that project, ` +
    `no isolated project reference and no privileged key in the bundle.`
);
if (settings.body?.mailer_autoconfirm === false) {
  console.log(
    'NOTE this project requires email confirmation; username-only sign-up depends on migration 0005 ' +
      '(namespace-scoped confirmation).'
  );
}
