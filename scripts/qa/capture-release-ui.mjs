// Captures the release UI evidence for this change and checks its layout:
// the Settings sidebar with Changelog last, the narrow layout, and the guest
// account reminder. Run against a built preview server:
//
//   node scripts/qa/capture-release-ui.mjs

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:4173';
const OUT = 'docs/qa';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

const browser = await chromium.launch();

async function openLibrary(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.gl-field input').fill('pirate');
  await page.locator('.gl-field input').press('Enter');
  await page.waitForSelector('header');
  const notice = page.locator('[aria-labelledby="library-notice-text"]');
  if (await notice.count()) await notice.getByRole('button', { name: 'Got it' }).click();
  await page.waitForTimeout(400);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await openLibrary(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.locator('[role="dialog"][aria-label="Settings"]');
  await dialog.getByRole('tab', { name: 'Changelog' }).click();
  await page.waitForTimeout(300);

  const sidebar = dialog.getByRole('tablist', { name: 'Settings sections' });
  const tabs = sidebar.getByRole('tab');
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"][aria-label="Settings"]');
    const list = panel.querySelector('[role="tablist"]');
    const content = list.nextElementSibling;
    const listBox = list.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    return {
      listLeft: listBox.left,
      listRight: listBox.right,
      contentLeft: contentBox.left,
      scrollWidth: content.scrollWidth,
      clientWidth: content.clientWidth,
    };
  });
  check('the settings sidebar sits on the left of the content', geometry.listLeft < geometry.contentLeft);
  check('the changelog content does not overflow its column', geometry.scrollWidth <= geometry.clientWidth + 1, JSON.stringify(geometry));
  const labels = (await tabs.allInnerTexts()).map((label) => label.trim());
  check('Changelog is the bottom-most sidebar entry', labels.at(-1) === 'Changelog', labels.join(' | '));
  const lastBox = await tabs.last().boundingBox();
  const firstBox = await tabs.first().boundingBox();
  check('the sidebar entries run downward', (lastBox?.y ?? 0) > (firstBox?.y ?? 0), `${firstBox?.y} → ${lastBox?.y}`);
  const releaseCount = await dialog.locator('ol li').count();
  check('the changelog shows the merged releases', releaseCount >= 8, String(releaseCount));
  await page.screenshot({ path: `${OUT}/changelog-settings.png` });
  await dialog.getByRole('button', { name: 'Close settings' }).click();

  // The reminder on a guest's first launch.
  await page.locator('[data-card] button[aria-label^="Play "]').first().click();
  const reminder = page.locator('[aria-labelledby="account-reminder-title"]');
  await reminder.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  check('the guest reminder is visible after choosing a game', await reminder.isVisible());
  // Let the short entrance transition finish before capturing.
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/account-reminder.png` });
  await desktop.close();

  // Narrow layout: the tabs stack above the content without overflow.
  const narrow = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await narrow.newPage();
  await openLibrary(phone);
  await phone.getByRole('button', { name: 'Settings' }).click();
  const phoneDialog = phone.locator('[role="dialog"][aria-label="Settings"]');
  await phoneDialog.getByRole('tab', { name: 'Changelog' }).click();
  await phone.waitForTimeout(300);
  const overflow = await phoneDialog.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  );
  check('the settings dialog has no horizontal overflow at 390px', overflow <= 1, String(overflow));
  check('Changelog stays reachable at 390px', await phoneDialog.getByRole('tab', { name: 'Changelog' }).isVisible());
  await phone.screenshot({ path: `${OUT}/changelog-settings-mobile.png` });
  await narrow.close();
} catch (error) {
  check('release UI capture threw', false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((entry) => !entry.ok);
for (const entry of results) console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` — ${entry.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} release UI checks passed`);
console.log('screenshots: docs/qa/changelog-settings.png, docs/qa/changelog-settings-mobile.png, docs/qa/account-reminder.png');
process.exit(failed.length === 0 ? 0 : 1);
