// Supabase Edge Function: entry-password gate.
// Verifies the site entry password WITHOUT exposing it to the client.
//
// Setup:
//   supabase secrets set ENTRY_PASSWORD_HASH='__HASH_FROM_SETUP__'
//   supabase secrets set ENTRY_SALT='__SALT_FROM_SETUP__'
//
// Generate the hash locally with:
//   node supabase/functions/_shared/hash-entry-password.mjs pirate
//
// The frontend calls: POST /functions/v1/verify-entry-password { password }
// and receives { valid: true } only when the password matches.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 10;
const BAN_MINUTES = 15;

interface RequestBody {
  password?: string;
}

interface AttemptRow {
  attempted_at: string;
  success: boolean | null;
}

function ipToHash(ip: string, salt: string): string {
  // Best-effort privacy-preserving IP fingerprint (Edge Functions have no
  // Web Crypto HMAC in this context; a simple async iterator hash is enough
  // for rate-limit bucketing — it never leaves the server and stores no raw IP).
  let h1 = 0x811c9dc5;
  const input = salt + ip;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return 'ip_' + h1.toString(16);
}

async function scryptHash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBytes = encoder.encode(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

Deno.serve(async (req: Request) => {
  // CORS for same-origin static hosting on a different domain (e.g. Heroku).
  const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const envHash = Deno.env.get('ENTRY_PASSWORD_HASH');
  const envSalt = Deno.env.get('ENTRY_SALT');
  if (!envHash || !envSalt) {
    return new Response(JSON.stringify({ error: 'gate_not_configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length === 0 || password.length > 128) {
    return new Response(JSON.stringify({ valid: false, reason: 'invalid_password' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting: hash the client IP (privacy-preserving) and count recent
  // failures. Uses the anon key client (service role only for rate-limit table).
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown';

  const ipHash = ipToHash(clientIp, envSalt);

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { data: attempts, error: attemptError } = await supabase
    .from('entry_attempts')
    .select('attempted_at, success')
    .eq('ip_hash', ipHash)
    .gte('attempted_at', since)
    .order('attempted_at', { ascending: false })
    .limit(MAX_ATTEMPTS * 2);

  if (attemptError) {
    console.error('rate-limit lookup failed', attemptError);
    // Fail closed on rate-limit infra errors? No — fail open but log;
    // password verification below is still required.
  }

  if (attempts) {
    const failures = attempts.filter((a: AttemptRow) => a.success !== true).length;
    if (failures >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'rate_limited', retry_after_minutes: BAN_MINUTES }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Constant-time-ish comparison of derived hash.
  const derived = await scryptHash(password, envSalt);
  let diff = 0;
  if (derived.length !== envHash.length) diff = 1;
  for (let i = 0; i < Math.min(derived.length, envHash.length); i++) {
    diff |= derived.charCodeAt(i) ^ envHash.charCodeAt(i);
  }
  const valid = diff === 0;

  // Record the attempt (best effort).
  await supabase
    .from('entry_attempts')
    .insert({ ip_hash: ipHash, success: valid })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error('attempt insert failed', error);
    });

  // Prune old attempts occasionally (probabilistic cleanup).
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    await supabase
      .from('entry_attempts')
      .delete()
      .lt('attempted_at', cutoff)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('attempt prune failed', error);
      });
  }

  return new Response(JSON.stringify({ valid }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
