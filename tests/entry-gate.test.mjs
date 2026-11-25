import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/entryGate.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source.replace(
  "import { isSupabaseConfigured, supabase } from './supabase';",
  'const { isSupabaseConfigured, supabase } = globalThis.__gateTest;',
), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;

test('the gate distinguishes an unconfigured backend from an invalid password', async () => {
  let reply = { valid: false, reason: 'gate_not_configured' };
  globalThis.__gateTest = { isSupabaseConfigured: true, supabase: { rpc: async () => ({ data: reply, error: null }) } };
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const gate = await import(`data:text/javascript;base64,${Buffer.from(script).toString('base64')}`);
  assert.deepEqual(await gate.verifyEntryPassword('test'), { ok: false, reason: 'not_configured' });
  assert.equal(gate.isEntryUnlocked(), false);
  reply = { valid: false };
  assert.deepEqual(await gate.verifyEntryPassword('test'), { ok: false, reason: 'invalid' });
  reply = { valid: false, reason: 'rate_limited' };
  assert.deepEqual(await gate.verifyEntryPassword('test'), { ok: false, reason: 'rate_limited' });
  reply = { valid: true };
  assert.deepEqual(await gate.verifyEntryPassword('test'), { ok: true });
  assert.equal(gate.isEntryUnlocked(), true);
});
