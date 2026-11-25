// Supabase Edge Function: entry-password gate.
// Verifies the site entry password WITHOUT exposing it to the client.
//
// Setup:
//   node supabase/functions/_shared/hash-entry-password.mjs pirate
//   supabase secrets set ENTRY_PASSWORD_HASH='...' ENTRY_SALT='...'
//   supabase functions deploy verify-entry-password
//
// The frontend calls POST /functions/v1/verify-entry-password { password }.
// Rate limiting: 10 failed attempts per 10 minutes per (hashed) IP, then a
// 15-minute lockout. Attempts are recorded in geegle.entry_attempts.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_ATTEMPTS = 10;
const WINDOW_MINUTES = 10;
const BAN_MINUTES = 15;
const SCHEMA = 'geegle';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  password?: string;
}

function ipToHash(ip: string, salt: string): string {
  let h1 = 0x811c9dc5;
  const input = salt + ip;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  return 'ip_' + h1.toString(16);
}

async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Constant-time comparison of two strings. */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
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
    return new Response(
      JSON.stringify({ valid: false, reason: 'invalid_password' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: SCHEMA },
  });

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown';
  const ipHash = ipToHash(clientIp, envSalt);

  // Rate limiting: count recent failures for this IP hash.
  const since = new Date(
    Date.now() - WINDOW_MINUTES * 60_000
  ).toISOString();
  const { data: attempts, error: attemptError } = await supabase
    .from('entry_attempts')
    .select('success')
    .eq('ip_hash', ipHash)
    .gte('attempted_at', since)
    .order('attempted_at', { ascending: false })
    .limit(MAX_ATTEMPTS * 2);

  if (attemptError) {
    console.error('rate-limit lookup failed:', attemptError.message);
  } else if (attempts) {
    const failures = attempts.filter((a) => a.success !== true).length;
    if (failures >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: 'rate_limited',
          retry_after_minutes: BAN_MINUTES,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const derived = await pbkdf2Hash(password, envSalt);
  const valid = timingSafeEqual(derived, envHash);

  // Record the attempt (best effort — never blocks the response).
  await supabase
    .from('entry_attempts')
    .insert({ ip_hash: ipHash, success: valid })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('attempt insert failed:', error.message);
    });

  // Occasional cleanup of old attempts.
  if (Math.random() < 0.05) {
    const cutoff = new Date(
      Date.now() - 24 * 60 * 60_000
    ).toISOString();
    await supabase
      .from('entry_attempts')
      .delete()
      .lt('attempted_at', cutoff)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('attempt prune failed:', error.message);
      });
  }

  return new Response(JSON.stringify({ valid }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
