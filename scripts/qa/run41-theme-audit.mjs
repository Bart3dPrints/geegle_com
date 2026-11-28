// Run 4.1 theme audit: opens every preset in light and dark mode, records the
// computed colours that matter (search field, nav, body text, cards) and writes
// a screenshot of each so the result can be inspected rather than assumed.
//
// Usage: start the app on 5173 in qa mode, then
// `bun scripts/qa/run41-theme-audit.mjs`

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
const OUT = 'docs/evidence/run41/presets';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];

const rgb = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const luminance = (channels) => {
  const linear = channels.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

await page.goto(`${BASE}/#games`, { waitUntil: 'domcontentloaded' });
const notice = page.locator('div.fixed.inset-0.z-50').first();
await notice.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
if (await notice.count()) {
  await notice.locator('button').last().click().catch(() => {});
}

const settings = page.locator('[role="dialog"][aria-label="Settings"]');
const openSettings = async () => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  // The shell mounts before the Theme tab's body, so wait on a control inside it.
  await page.locator('[data-theme-preset]').first().waitFor({ state: 'visible', timeout: 8000 });
};
await openSettings();
const presets = await page.locator('[data-theme-preset]').evaluateAll((nodes) =>
  nodes.map((node) => ({ id: node.getAttribute('data-theme-preset'), name: node.textContent.trim() })),
);

for (const mode of ['Light', 'Dark']) {
  // The buttons carry lowercase text and are capitalised by CSS, so match the
  // name case-insensitively.
  await page.getByRole('button', { name: new RegExp(`^${mode}$`, 'i') }).first().click();
  await page.waitForTimeout(250);
  for (const preset of presets) {
    const button = page.locator(`[data-theme-preset="${preset.id}"]`);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await page.waitForTimeout(320);
    await page.keyboard.press('Escape');
    await settings.waitFor({ state: 'hidden', timeout: 4000 });
    await page.waitForTimeout(320);

    const sample = await page.evaluate(() => {
      const style = (el) => (el ? getComputedStyle(el) : null);
      const search = document.querySelector('input[placeholder="Search games, apps and proxies"]');
      const field = document.querySelector('.geegle-field');
      const nav = document.querySelector('nav[aria-label="Sections"] button:not([aria-current])');
      const activeNav = document.querySelector('nav[aria-label="Sections"] button[aria-current]');
      const header = document.querySelector('header');
      const card = document.querySelector('.card');
      const muted = [...document.querySelectorAll('p')].find((el) => el.innerText.includes('Found a bug'));
      return {
        body: style(document.body).backgroundColor,
        header: header ? style(header).backgroundColor : null,
        card: card ? style(card).backgroundColor : null,
        cardBorder: card ? style(card).borderColor : null,
        searchBg: field ? style(field).backgroundColor : null,
        searchColor: search ? style(search).color : null,
        searchPlaceholder: search ? style(search).getPropertyValue('--tw-placeholder') : null,
        navColor: nav ? style(nav).color : null,
        activeNavColor: activeNav ? style(activeNav).color : null,
        mutedColor: muted ? style(muted).color : null,
        mutedBg: muted?.closest('div') ? style(muted.closest('div')).backgroundColor : null,
      };
    });

    const file = `${OUT}/${mode.toLowerCase()}-${preset.id}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 74 });
    const navContrast = sample.header && sample.navColor ? ratio(sample.navColor, sample.header) : 0;
    const activeContrast = sample.header && sample.activeNavColor ? ratio(sample.activeNavColor, sample.header) : 0;
    const searchContrast = sample.searchColor && sample.searchBg ? ratio(sample.searchColor, sample.searchBg) : 0;
    const mutedContrast = sample.mutedColor && sample.mutedBg ? ratio(sample.mutedColor, sample.mutedBg) : 0;
    const row = {
      mode,
      preset: preset.id,
      body: sample.body,
      searchBg: sample.searchBg,
      navContrast: navContrast.toFixed(2),
      activeContrast: activeContrast.toFixed(2),
      searchContrast: searchContrast.toFixed(2),
      mutedContrast: mutedContrast.toFixed(2),
    };
    console.log(JSON.stringify(row));
    if (navContrast < 4.5) failures.push(`${mode}/${preset.id}: inactive nav ${navContrast.toFixed(2)}:1`);
    if (activeContrast < 4.5) failures.push(`${mode}/${preset.id}: active nav ${activeContrast.toFixed(2)}:1`);
    if (searchContrast < 4.5) failures.push(`${mode}/${preset.id}: search text ${searchContrast.toFixed(2)}:1`);
    if (mutedContrast && mutedContrast < 4.5) failures.push(`${mode}/${preset.id}: body text ${mutedContrast.toFixed(2)}:1`);
    // The search field must belong to the active theme, not stay white in dark.
    const isDarkField = luminance(rgb(sample.searchBg)) < 0.2;
    const isDarkTheme = luminance(rgb(sample.body)) < 0.2;
    if (isDarkTheme !== isDarkField) failures.push(`${mode}/${preset.id}: search field ${sample.searchBg} does not match a ${isDarkTheme ? 'dark' : 'light'} page`);

    await openSettings();
    await page.waitForTimeout(200);
  }
}

console.log(failures.length ? `\nFAILURES\n${failures.join('\n')}` : '\nALL THEME CHECKS PASSED');
await browser.close();
process.exit(failures.length ? 1 : 0);
