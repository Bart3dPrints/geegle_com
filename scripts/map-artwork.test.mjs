import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('artwork generation fails closed when bytes, notice, or output drift', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'geegle-artwork-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const root = new URL('../', import.meta.url);
  for (const dir of ['scripts', 'public', 'src/data']) await mkdir(join(temp, dir), { recursive: true });
  for (const file of ['scripts/map-artwork.mjs', 'scripts/artwork-map.json', 'src/data/artwork.ts']) {
    await cp(new URL(file, root), join(temp, file));
  }
  await cp(new URL('public/artwork', root), join(temp, 'public/artwork'), { recursive: true });

  const check = () => spawnSync(process.execPath, ['scripts/map-artwork.mjs', '--check'], {
    cwd: temp,
    encoding: 'utf8',
  });
  const original = check();
  assert.equal(original.status, 0, original.stderr);

  const png = join(temp, 'public/artwork/2048.png');
  const sourceBytes = await readFile(png);
  await writeFile(png, 'unreviewed bytes');
  assert.match(check().stderr, /mismatched asset checksum.*cl2048/);
  await writeFile(png, sourceBytes);

  const notice = join(temp, 'public/artwork/2048-mit.txt');
  const license = await readFile(notice);
  await writeFile(notice, '');
  assert.match(check().stderr, /Invalid notice.*cl2048/);
  await writeFile(notice, license);

  await writeFile(join(temp, 'src/data/artwork.ts'), 'stale');
  assert.match(check().stderr, /Artwork index is stale/);
});
