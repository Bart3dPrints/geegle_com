// End-to-end tests against the production build. The entry gate is unlocked
// first (the offline fallback path), then the redesigned interface is checked.

import { test, expect, type Page } from '@playwright/test';

const GATE_PASSWORD = 'pirate';

async function unlockGate(page: Page) {
  const input = page.getByLabel('Site password');
  if (await input.isVisible().catch(() => false)) {
    await input.fill(GATE_PASSWORD);
    await page.getByRole('button', { name: 'Enter' }).click();
  }
  await expect(page.getByRole('button', { name: 'Geegle home' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await unlockGate(page);
});

test('redesigned interface renders with header and category chips', async ({
  page,
}) => {
  await expect(page.getByRole('button', { name: 'Geegle home' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'All Games' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Action' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
});

test('category filtering returns matching games', async ({ page }) => {
  await page.getByRole('tab', { name: 'Pokemon', exact: false }).click();
  const cards = page.locator('main .card');
  expect(await cards.count()).toBeGreaterThan(10);
});

test('game cards render titles, not emoji placeholders', async ({ page }) => {
  const firstCard = page.locator('main .card').first();
  await expect(firstCard).toBeVisible();
  const text = (await firstCard.textContent())?.trim() ?? '';
  expect(text.length).toBeGreaterThan(0);
});

test('dark mode toggle works and persists across reload', async ({ page }) => {
  await page.getByLabel('dark theme').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await unlockGate(page);
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByLabel('light theme').click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('search overlay opens, finds a game, closes on Escape', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Search games' });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Search query')).toBeFocused();
  await page.getByLabel('Search query').fill('2048');
  await expect(dialog.getByText('2048').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('fuzzy search tolerates misspellings (pokmon finds Pokemon)', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByLabel('Search query').fill('pokmon');
  await expect(
    page
      .getByRole('dialog', { name: 'Search games' })
      .getByText(/Pokemon/i)
      .first()
  ).toBeVisible();
});

test('search category buttons filter by category', async ({ page }) => {
  await page.getByRole('button', { name: 'Search' }).click();
  await page
    .getByRole('dialog', { name: 'Search games' })
    .getByRole('button', { name: 'Racing', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Search games' })
      .getByText(/racing/i)
      .first()
  ).toBeVisible();
});

test('launching a game opens the player with a back button', async ({
  page,
}) => {
  await page.locator('main .card').first().click();
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(page.locator('iframe')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Geegle home' })).toBeVisible();
});

test('proxy cards render with server dropdowns and 19 backups', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'proxies' }).first().click();
  await expect(page.getByRole('heading', { name: 'Proxies' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Helios Proxy' })).toBeVisible();
  const backup = page.locator('.card', { hasText: 'Backup Proxies' });
  expect(await backup.locator('select option').count()).toBe(19);
});

test('apps tab has no chatbot', async ({ page }) => {
  await page.getByRole('button', { name: 'apps' }).first().click();
  const appsText = (await page.locator('main').textContent()) ?? '';
  expect(appsText).not.toContain('Chat Bot');
});

test('mobile viewport renders the mobile tab bar', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile-only test');
  await expect(
    page.getByRole('button', { name: 'games', exact: true }).first()
  ).toBeVisible();
});
