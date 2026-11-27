// Artwork integrity regression guard.
//
// Every artwork record that the UI can display must point at a real, decodable
// WebP whose bytes match the recorded SHA-256, and unrelated titles must not
// share the same image. This is the automated half of the artwork review; the
// visual half lives in scripts/artwork/review.json and docs/ARTWORK_COMPLETION_REPORT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const map = JSON.parse(readFileSync(path.join(root, 'scripts/artwork-map.json'), 'utf8'));
const captured = JSON.parse(readFileSync(path.join(root, 'scripts/artwork/captured.json'), 'utf8'));
const review = JSON.parse(readFileSync(path.join(root, 'scripts/artwork/review.json'), 'utf8'));

const records = { ...map.cleared, ...captured.assets, ...captured.screens };

test('every artwork record has a decodable WebP with matching bytes', () => {
  assert.ok(Object.keys(records).length > 0, 'expected artwork records');
  for (const [id, record] of Object.entries(records)) {
    assert.match(record.url, /^\/artwork\/[A-Za-z0-9._-]+\.webp$/, `${id} url`);
    const file = path.join(root, 'public', record.url.replace(/^\//, ''));
    assert.ok(existsSync(file), `${id} image exists`);
    assert.ok(statSync(file).size > 500, `${id} image is not a placeholder`);
    const bytes = readFileSync(file);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${id} WebP header`);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${id} WebP marker`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.assetSha256, `${id} integrity`);
    assert.ok(record.title && record.source && record.identityEvidence && record.reuseEvidence, `${id} evidence`);
  }
});

test('no unrelated titles share the same artwork', () => {
  const byHash = new Map();
  for (const [id, record] of Object.entries(records)) {
    const list = byHash.get(record.assetSha256) ?? [];
    list.push({ id, title: record.title });
    byHash.set(record.assetSha256, list);
  }
  for (const list of byHash.values()) {
    const titles = new Set(list.map((item) => item.title));
    if (list.length < 2) continue;
    // The two Time Shooter 3 catalog rows are the same game; shared art is real.
    const sameGame = titles.size === 1;
    const timeShooter = list.every((item) => /^time ?shooter/i.test(item.title));
    assert.ok(sameGame || timeShooter, `shared artwork across unrelated titles: ${list.map((i) => i.id).join(', ')}`);
  }
});

test('rejected artwork is never present in runtime records', () => {
  for (const [id, decision] of Object.entries(review)) {
    if (decision.status !== 'rejected') continue;
    assert.equal(records[id], undefined, `${id} is rejected but still displayed`);
  }
});

test('every captured screen is marked for review, never silently verified', () => {
  for (const [id, record] of Object.entries(captured.screens)) {
    assert.ok(
      record.reviewStatus === 'awaiting-review' || review[id]?.status === 'verified',
      `${id} review state`,
    );
  }
});
