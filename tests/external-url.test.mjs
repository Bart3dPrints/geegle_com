// External URL guards: one https:// scheme, no doubled schemes, relative
// application paths preserved, unsupported protocols rejected, and every
// configured proxy endpoint usable as-is.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { outputFiles: [{ text }] } = await build({
  stdin: { resolveDir: process.cwd(), contents: "export * from './src/lib/externalUrl.ts';" },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const url = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

test('a bare hostname gains one https scheme', () => {
  assert.equal(url.normalizeExternalUrl('youtube.com/watch?v=abc'), 'https://youtube.com/watch?v=abc');
  assert.equal(url.normalizeExternalUrl('  krillion.cc  '), 'https://krillion.cc/');
});

test('an existing https address is never prefixed again', () => {
  const normalized = url.normalizeExternalUrl('https://krillion.cc/embed-guide/');
  assert.equal(normalized, 'https://krillion.cc/embed-guide/');
  assert.equal(normalized.match(/https:\/\//g).length, 1);
});

test('http is upgraded to https exactly once', () => {
  assert.equal(url.normalizeExternalUrl('http://example.com/a'), 'https://example.com/a');
});

test('doubled schemes are rejected instead of rewritten', () => {
  assert.equal(url.normalizeExternalUrl('https://https://example.com'), null);
  assert.equal(url.normalizeExternalUrl('https://example.com/https://other.test'), null);
});

test('relative application paths stay relative', () => {
  assert.equal(url.normalizeExternalUrl('/games/wrapper.html'), '/games/wrapper.html');
  assert.equal(url.normalizeExternalUrl('/games/Soundboard.html'), '/games/Soundboard.html');
  assert.equal(url.normalizeExternalUrl('//evil.example/x'), null);
});

test('unsupported or dangerous protocols are rejected', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
    'ftp://example.com/a',
    'mailto:someone@example.com',
    'https://user:pass@example.com/',
    'not a url',
  ]) {
    assert.equal(url.normalizeExternalUrl(value), null, value);
  }
  assert.equal(url.normalizeExternalUrl(''), null);
});

test('isSingleHttpsUrl confirms exactly one scheme', () => {
  assert.equal(url.isSingleHttpsUrl('https://example.com/'), true);
  assert.equal(url.isSingleHttpsUrl('https://https://example.com'), false);
  assert.equal(url.isSingleHttpsUrl('http://example.com'), false);
  assert.equal(url.isSingleHttpsUrl('/games/a.html'), false);
});

test('every configured proxy endpoint is a single valid https address', () => {
  const source = readFileSync('src/data/proxies.ts', 'utf8');
  const endpoints = [...source.matchAll(/(?:remote|local)\('Server \d+', '([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(endpoints.length >= 50, `only ${endpoints.length} endpoints found`);
  for (const endpoint of endpoints) {
    if (endpoint.startsWith('/')) {
      assert.equal(url.normalizeExternalUrl(endpoint), endpoint, endpoint);
      continue;
    }
    assert.equal(url.isSingleHttpsUrl(endpoint), true, endpoint);
    assert.equal(url.normalizeExternalUrl(endpoint), endpoint, endpoint);
  }
});

test('the YouTube player normalizes once and stays on YouTube hosts', () => {
  const source = readFileSync('src/components/YouTubeApp.tsx', 'utf8');
  assert.match(source, /normalizeExternalUrl/);
  assert.ok(!/startsWith\('http'\) \? trimmed : `https:\/\/\$\{trimmed\}`/.test(source), 'no blind prefix');
  assert.match(source, /youtube-nocookie\.com/);
  assert.match(source, /includes\(host\)/);
});
