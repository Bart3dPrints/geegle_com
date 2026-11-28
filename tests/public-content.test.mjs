// The public interface must never expose development instructions, agent or
// tool names, project-phase wording or internal notes. These tests fail if
// that content reappears in source, in served HTML, or in the production build.
//
// Scope: authored interface text. Game titles and content in src/data/raw are
// data, not copy, and are deliberately not scanned.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const { outputFiles: [{ text }] } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: "export * from './src/lib/brand.ts';",
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});

const { SITE_TITLE, FOOTER_TEXT } = await import(
  `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`
);

const PROHIBITED = [
  /artificial intelligence/i,
  /\bAI[- ]generated\b/i,
  /\bAI[- ]assisted\b/i,
  /\bAI[- ]powered\b/i,
  /\bcoding agent\b/i,
  /\bFreebuff\b/,
  /\bCodebuff\b/,
  /\bCodex\b/,
  /\bAshnaAI\b/,
  /\boverhaul/i,
  /\bre-?design(?:ed|ing)?\b/i,
  /\bimplementation phase\b/i,
  /\bmigration progress\b/i,
  /\bcompletion percentage\b/i,
  /\bdesign audit\b/i,
  /\bdesign report\b/i,
  /\bVibe[- ]Coded\b/i,
  /\bprompt contents?\b/i,
  /\bexperimental implementation\b/i,
  /\bproject specification\b/i,
  /\b7%\s*stop\b/i,
];

/** Remove comments so implementation notes in source are not misread as copy. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

function walk(dir, extensions, found = []) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, extensions, found);
    else if (extensions.some((extension) => name.endsWith(extension))) found.push(path);
  }
  return found;
}

function violations(files, transform = (source) => source) {
  const hits = [];
  for (const file of files) {
    const source = transform(readFileSync(file, 'utf8'));
    for (const pattern of PROHIBITED) {
      const match = source.match(pattern);
      if (match) hits.push(`${relative(process.cwd(), file)}: "${match[0]}"`);
    }
  }
  return hits;
}

test('the browser tab title is exactly Geegle', () => {
  assert.equal(SITE_TITLE, 'Geegle');
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<title>Geegle<\/title>/);
  const titles = html.match(/<title>[\s\S]*?<\/title>/g) ?? [];
  assert.equal(titles.length, 1);
});

test('the library footer is exactly the requested sentence', () => {
  assert.equal(FOOTER_TEXT, 'Bart made this. Thank him');
  const app = readFileSync('src/App.tsx', 'utf8');
  const footer = app.match(/<footer[\s\S]*?<\/footer>/);
  assert.ok(footer, 'the library renders a footer element');
  const visible = footer[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(visible, '{FOOTER_TEXT}');
});

test('the favicon is an independent Geegle mark', () => {
  const svg = readFileSync('public/favicon.svg', 'utf8');
  // A neutral rounded tile with a lens mark; never Google's multicolour G.
  assert.match(svg, /<rect/);
  assert.match(svg, /<circle/);
  assert.ok(!/4285f4|34a853|fbbc05|ea4335/i.test(svg), 'no Google brand colours');
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/favicon.svg"/);
  assert.match(html, /rel="apple-touch-icon"/);
});

test('no development or agent wording appears in authored interface text', () => {
  const files = walk('src', ['.ts', '.tsx', '.css']);
  assert.deepEqual(violations(files, stripComments), []);
});

test('served HTML and public assets contain no development wording', () => {
  const files = walk('public', ['.html']).filter(
    // Game wrappers are third-party documents, not Geegle interface copy.
    (file) => !relative(process.cwd(), file).startsWith(join('public', 'games'))
  );
  assert.deepEqual(violations(files), []);
});

test('the library has no secondary password page', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  for (const phrase of [
    'Enter the site password',
    'verifyEntryPassword',
    'isEntryUnlocked',
    'gateOpen',
  ]) {
    assert.ok(!app.includes(phrase), `App.tsx still contains ${phrase}`);
  }
});

test('the landing page has no visible Games shortcut', () => {
  const landing = readFileSync('src/components/SearchLanding.tsx', 'utf8');
  assert.ok(!landing.includes('gl-library'));
});

test('development documentation and secrets are not published', () => {
  const served = walk('public', ['.md', '.env', '.local', '.sql']);
  assert.deepEqual(served, []);
  const forbidden = ['package.json', 'PROJECT_COMPLETION.md', 'README.md', 'tsconfig.json'];
  for (const file of forbidden) {
    assert.ok(!existsSync(join('public', file)), `${file} must not be served`);
    assert.ok(!existsSync(join('dist', file)), `${file} must not be in the build`);
  }
});

test('the production build carries none of the prohibited wording', { skip: !existsSync('dist/assets') }, () => {
  // Only the shell and bundled assets; dist/games is the unchanged game blobs.
  const files = [
    ...walk('dist/assets', ['.js', '.css']),
    ...(existsSync('dist/index.html') ? ['dist/index.html'] : []),
  ];
  assert.deepEqual(violations(files), []);
});
