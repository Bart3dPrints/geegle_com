// Run 3 browser acceptance: two independent accounts, live requests, presence,
// the visitor counter, guest restriction, Everythingle removal and responsive
// layout. Drives the real app against the local/isolated Supabase stack.
//
// Usage: start the app with `npm run dev -- --mode qa --port 5173`, then
// `bun scripts/qa/run3-browser-check.mjs`.

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

const tag = () => `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1e4)}`;
const password = 'Friend-check-1';

async function dismissNotices(page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator('div.fixed.inset-0.z-50').first();
    const appeared = await overlay
      .waitFor({ state: 'visible', timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (!appeared) return;
    const buttons = overlay.locator('button');
    if ((await buttons.count()) === 0) return;
    await buttons.last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function openLibrary(page) {
  await page.goto(`${BASE}/#games`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await dismissNotices(page);
}

async function register(page, username) {
  await dismissNotices(page);
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByRole('button', { name: /Create one/i }).click();
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(1800);
  await dismissNotices(page);
  return (await page.getByLabel('Account').count()) === 1;
}

async function openFriends(page) {
  await page.getByRole('button', { name: 'friends', exact: true }).click();
  await page.waitForTimeout(400);
  await dismissNotices(page);
}

const browser = await chromium.launch();

try {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const pageGuest = await ctxGuest.newPage();

  const problems = [];
  // Destructive actions ask for confirmation; the journey confirms them.
  pageA.on('dialog', (dialog) => void dialog.accept());
  for (const [label, page] of [['A', pageA], ['B', pageB], ['guest', pageGuest]]) {
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${label}: ${message.text().slice(0, 160)}`);
    });
  }

  const userA = `ann${tag()}`;
  const userB = `ben${tag()}`;

  await openLibrary(pageA);
  await openLibrary(pageB);
  await openLibrary(pageGuest);

  check('account A registers', await register(pageA, userA));
  check('account B registers', await register(pageB, userB));

  // Guests must not reach private data.
  await openFriends(pageGuest);
  check('a guest is asked to sign in', (await pageGuest.getByRole('button', { name: 'Sign in', exact: true }).count()) >= 1);
  check('a guest gets no account search', (await pageGuest.getByLabel('Search accounts by username').count()) === 0);

  await openFriends(pageA);
  check('Friends is a header tab', (await pageA.getByRole('button', { name: 'friends', exact: true }).count()) === 1);

  // 1/2: discovery and request.
  await pageA.getByLabel('Search accounts by username').fill(userB);
  await pageA.waitForSelector(`[data-search-result]`, { timeout: 10000 }).catch(() => {});
  const resultCount = await pageA.locator('[data-search-result]').count();
  check('A finds B by username', resultCount >= 1, String(resultCount));
  await pageA.locator('[data-search-result]').first().getByRole('button', { name: 'Add' }).click();
  await pageA.waitForTimeout(1200);
  check('A shows the request as sent', (await pageA.locator('[data-outgoing]').count()) >= 1);

  // 3: B receives it live, with no reload.
  await openFriends(pageB);
  await pageB.waitForSelector('[data-incoming]', { timeout: 15000 }).catch(() => {});
  check('B receives the request without refreshing', (await pageB.locator('[data-incoming]').count()) >= 1);

  // 4/5: accept, both sides update live.
  await pageB.locator('[data-incoming]').first().getByRole('button', { name: 'Accept' }).click();
  await pageB.waitForSelector('[data-friend]', { timeout: 15000 }).catch(() => {});
  await pageA.waitForSelector('[data-friend]', { timeout: 15000 }).catch(() => {});
  check('B sees the friendship', (await pageB.locator('[data-friend]').count()) >= 1);
  check('A sees the friendship without refreshing', (await pageA.locator('[data-friend]').count()) >= 1);

  // 6: survives a reload.
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(900);
  await dismissNotices(pageA);
  await openFriends(pageA);
  await pageA.waitForSelector('[data-friend]', { timeout: 10000 }).catch(() => {});
  check('the friendship survives a reload', (await pageA.locator('[data-friend]').count()) >= 1);

  // 17: presence shows a permitted friend as online.
  let online = 0;
  for (let attempt = 0; attempt < 20 && online === 0; attempt += 1) {
    online = await pageA.locator('[data-friend] span[aria-label="Online"]').count();
    if (!online) await pageA.waitForTimeout(500);
  }
  check('a connected friend shows as online', online >= 1, String(online));

  // 19/20: the counter includes this visitor and counts people.
  const counterA = await pageA.locator('header span[aria-label$="online"]').first().getAttribute('aria-label').catch(() => null);
  const reported = Number((counterA ?? '').match(/^(\d+)/)?.[1] ?? 0);
  check('the visitor counter includes the viewer', reported >= 1, counterA ?? 'missing');
  check('two accounts are not double-counted as four', reported >= 2 && reported <= 3, String(reported));

  // Multiple tabs of one account must not inflate the count.
  const secondTab = await ctxA.newPage();
  await secondTab.goto(`${BASE}/#games`, { waitUntil: 'domcontentloaded' });
  await secondTab.waitForTimeout(2500);
  const counterAfter = await pageB.locator('header span[aria-label$="online"]').first().getAttribute('aria-label').catch(() => null);
  const after = Number((counterAfter ?? '').match(/^(\d+)/)?.[1] ?? 0);
  check('a second tab of the same account does not add a visitor', after <= reported, `${reported} -> ${after}`);
  await secondTab.close();

  // 22: Everythingle is completely absent.
  await pageA.getByRole('button', { name: 'apps', exact: true }).click();
  await pageA.waitForTimeout(400);
  const appsText = await pageA.locator('main').innerText();
  check('no Everythingle card in Apps', !/everythingle/i.test(appsText));
  await pageA.getByPlaceholder(/Search games, apps and proxies/).fill('everythingle');
  await pageA.waitForTimeout(500);
  const searchText = await pageA.locator('main').innerText();
  check('searching for Everythingle finds nothing', !/everythingle/i.test(searchText));
  await pageA.getByPlaceholder(/Search games, apps and proxies/).fill('');
  await pageA.waitForTimeout(300);

  // 23: independent games still work (Krillion cards remain).
  await pageA.getByRole('button', { name: 'games', exact: true }).click();
  await pageA.waitForTimeout(400);
  const gameText = await pageA.locator('main').innerText();
  check('Krillion games remain in the catalogue', (gameText.match(/Krillion/gi) ?? []).length >= 2);

  // 12: blocking (through the UI) removes the friendship.
  await openFriends(pageA);
  await pageA.locator('[data-friend]').first().getByRole('button', { name: 'Block' }).click();
  let bFriendsAfterBlock = 1;
  for (let attempt = 0; attempt < 20 && bFriendsAfterBlock > 0; attempt += 1) {
    await pageB.waitForTimeout(500);
    bFriendsAfterBlock = await pageB.locator('[data-friend]').count();
  }
  check('blocking removes the friendship on the other account', bFriendsAfterBlock === 0, String(bFriendsAfterBlock));

  // 15: responsive layout, no horizontal overflow, header height unchanged.
  const sizes = [[1024, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [390, 844]];
  await pageA.setViewportSize({ width: 1440, height: 900 });
  await openFriends(pageA);
  // Baseline for each viewport is the same header with the counter hidden, so
  // natural mobile wrapping is not mistaken for a regression.
  const topRowWithoutCounter = async () =>
    pageA.evaluate(() => {
      const counter = document.querySelector(
        'header span[aria-label$="online"], header span[aria-label="Visitors unavailable"]',
      );
      const row = document.querySelector('header > div');
      if (!counter || !row) return null;
      const previous = counter.style.display;
      counter.style.display = 'none';
      const height = Math.round(row.getBoundingClientRect().height);
      counter.style.display = previous;
      return height;
    });
  for (const [width, height] of sizes) {
    await pageA.setViewportSize({ width, height });
    await pageA.waitForTimeout(300);
    const overflow = await pageA.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal overflow at ${width}x${height}`, overflow <= 1, String(overflow));
    const topRow = await pageA.locator('header > div').first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const baseline = await topRowWithoutCounter();
    check(`header row height unchanged at ${width}x${height}`, baseline !== null && topRow <= baseline, `${topRow} vs ${baseline}`);
    const counter = await pageA.locator('header span[aria-label$="online"]').count();
    check(`visitor counter present at ${width}x${height}`, counter === 1);
  }
  await pageA.setViewportSize({ width: 1440, height: 900 });
  await pageA.screenshot({ path: '/tmp/run3-friends-1440.png', fullPage: false });
  await pageA.setViewportSize({ width: 390, height: 844 });
  await pageA.screenshot({ path: '/tmp/run3-friends-390.png', fullPage: false });

  check('no console errors during the journey', problems.length === 0, problems.slice(0, 3).join(' | '));

  await ctxA.close();
  await ctxB.close();
  await ctxGuest.close();
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL BROWSER CHECKS PASSED' : `${failures} BROWSER CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
