#!/usr/bin/env node
// Regenerates the Settings → Changelog snapshot from this repository's merged
// pull requests.
//
// Runs before `vite build`, so a deployment that follows a merge already
// contains the new release. It never fails a build: if GitHub is unreachable
// (or the rate limit is hit) the committed snapshot is kept. Nothing is
// committed back, which avoids recursive commits and endless workflows, and
// no GitHub credential is ever shipped to the browser — only the resulting
// static list is bundled.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const OWNER = 'Bart3dPrints';
const REPO = 'geegle_com';
const OUTPUT = 'src/data/changelog.json';
const NOTES = 'scripts/changelog-notes.json';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/pulls`;

async function loadRules() {
  // The same normalization the UI relies on (merged only, one entry per PR,
  // newest first) is reused here so there is a single definition.
  const { outputFiles: [{ text }] } = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: "export { mergedPullEntries } from './src/lib/changelog.ts';",
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  });
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}

async function fetchMergedPulls() {
  const pulls = [];
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'geegle-changelog',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let url = `${API}?state=closed&per_page=100&sort=updated&direction=desc`;
  for (let page = 0; url && page < 10; page += 1) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub replied ${response.status}`);
    pulls.push(...(await response.json()));
    const link = response.headers.get('link') ?? '';
    url = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? '';
  }
  return pulls;
}

async function main() {
  let notes = {};
  try {
    notes = JSON.parse(readFileSync(NOTES, 'utf8'));
  } catch {
    notes = {};
  }

  const { mergedPullEntries } = await loadRules();
  const pulls = await fetchMergedPulls();
  const entries = mergedPullEntries(
    pulls.map((pull) => ({ number: pull.number, title: pull.title, merged_at: pull.merged_at })),
    notes
  );
  if (entries.length === 0) throw new Error('no merged pull requests were returned');

  const prs = entries.map((entry) => entry.pr);
  if (new Set(prs).size !== prs.length) throw new Error('duplicate release entries');

  const next = `${JSON.stringify({ source: `github:${OWNER}/${REPO}`, entries }, null, 2)}\n`;
  const previous = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (next !== previous) {
    writeFileSync(OUTPUT, next);
    console.log(`changelog: ${entries.length} releases written to ${OUTPUT}`);
  } else {
    console.log(`changelog: ${entries.length} releases already current`);
  }

  const missingNotes = entries.filter((entry) => !notes[String(entry.pr)]).map((entry) => entry.pr);
  if (missingNotes.length > 0) {
    console.log(
      `changelog: PR ${missingNotes.join(', ')} used the title as its summary; add a short note to ${NOTES}`
    );
  }
}

main().catch((error) => {
  console.warn(`changelog: keeping the committed snapshot (${error instanceof Error ? error.message : error})`);
  process.exitCode = 0;
});
