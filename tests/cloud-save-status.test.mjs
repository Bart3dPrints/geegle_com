// Cloud-save feedback guards: no persistent status box in the player, but
// manual saves and actionable synchronisation failures still say something.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const player = readFileSync('src/components/GamePlayer.tsx', 'utf8');

test('no persistent cloud-save status pill is rendered', () => {
  assert.ok(!/Saved to Cloud/.test(player), 'the routine success label is gone');
  assert.ok(!/function StatusPill/.test(player));
  assert.ok(!/bottom-3 right-3/.test(player), 'the bottom-right container is removed, not emptied');
  assert.ok(!/Cloud Saves Unsupported/.test(player), 'no standing unsupported badge');
});

test('routine automatic saves stay silent', () => {
  const setter = player.slice(player.indexOf('const sync = startCloudSync'), player.indexOf('await sync.restored'));
  assert.ok(!/setManualMsg\(/.test(setter), 'the 15-second sync reports nothing to the player UI');
});

test('manual save and restore still report their own result', () => {
  assert.match(player, /setManualMsg\('Progress saved to cloud\.'\)/);
  assert.match(player, /setManualMsg\(result\.restored \? 'Cloud save restored\.'/);
  assert.match(player, /setManualMsg\('Save file downloaded\.'\)/);
  assert.match(player, /'Save file imported and synced to the cloud\.'/);
});

test('an actionable synchronisation failure is still surfaced', () => {
  assert.match(player, /syncStatus === 'conflict'/);
  assert.match(player, /Cloud progress differs\. Choose Restore from Cloud or Keep This Device\./);
  assert.match(player, /Cloud sync failed\. Your device still has its saved progress\./);
});

test('manual-save feedback uses the single message line, not a standing box', () => {
  assert.equal(player.match(/inset-x-3 bottom-3/g)?.length, 1);
});
