// Run 4 browser acceptance: the chat tab, live delivery, the three-dot actions,
// forwarding, per-account DM backgrounds, groups, guest/stranger restrictions
// and responsive layout. Drives the real app against the local Supabase stack.
//
// Usage: `npm run dev -- --mode qa --port 5173`, then
// `bun scripts/qa/run4-browser-check.mjs`.

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

const tag = () => `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1e4)}`;
const password = 'Chat-check-1';

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

async function openTab(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(500);
  await dismissNotices(page);
}

async function sendChat(page, text) {
  const field = page.getByLabel('Message text');
  await field.waitFor({ state: 'visible', timeout: 10000 });
  await field.fill(text);
  await page.getByLabel('Send message').click();
  await page.waitForTimeout(600);
}

async function openPublic(page) {
  await page.locator('[data-conversation-kind="public"]').first().click();
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();

try {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxC = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const pageC = await ctxC.newPage();

  const problems = [];
  for (const [label, page] of [['A', pageA], ['B', pageB], ['C', pageC]]) {
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${label}: ${message.text().slice(0, 160)}`);
    });
    page.on('pageerror', (error) => problems.push(`${label}: ${String(error).slice(0, 160)}`));
  }

  const userA = `chat${tag()}`;
  const userB = `chat${tag()}`;
  const userC = `chat${tag()}`;

  await openLibrary(pageA);
  await openLibrary(pageB);
  await openLibrary(pageC);

  check('account A registers', await register(pageA, userA));
  check('account B registers', await register(pageB, userB));
  check('account C registers', await register(pageC, userC));

  // --- navigation ---------------------------------------------------------
  const tabNames = await pageA.locator('nav[aria-label="Sections"] button').allInnerTexts();
  check('tabs are Games, Apps, Proxies, Friends, Chat in that order', tabNames.map((name) => name.trim().toLowerCase()).join('|') === 'games|apps|proxies|friends|chat', tabNames.join('|'));
  const tabRow = await pageA.locator('nav[aria-label="Sections"] button').evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
  check('the tab row stays on one line', new Set(tabRow).size === 1, tabRow.join(','));

  // --- friendship so a DM is possible ------------------------------------
  await openTab(pageA, 'friends');
  await pageA.getByLabel('Search accounts by username').fill(userB);
  await pageA.waitForSelector('[data-search-result]', { timeout: 10000 });
  await pageA.locator('[data-search-result]').first().getByRole('button', { name: 'Add' }).click();
  await pageA.waitForTimeout(800);
  await openTab(pageB, 'friends');
  await pageB.locator('[data-incoming]').first().getByRole('button', { name: 'Accept' }).click();
  await pageB.waitForTimeout(800);
  check('A and B are friends', (await pageA.locator('[data-friend]').count()) >= 1);

  // --- public room, live ------------------------------------------------
  await openTab(pageB, 'chat');
  await openTab(pageA, 'chat');
  check('the chat tab shows the public room', (await pageA.locator('[data-chat-title]').first().innerText()).toLowerCase().includes('public'));

  const publicText = `hello run4 ${tag()}`;
  await openPublic(pageA);
  await sendChat(pageA, publicText);
  const delivered = await pageB
    .getByText(publicText, { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  check('B receives the public message live, without reloading', delivered);

  // --- a direct message between friends ---------------------------------
  await pageA.getByRole('button', { name: 'New message' }).click();
  await pageA.locator('[data-start-dm]').first().click();
  await pageA.waitForTimeout(1200);
  const dmTitle = (await pageA.locator('[data-chat-title]').first().innerText()).toLowerCase();
  check('a DM opens with the accepted friend', dmTitle.includes(userB.toLowerCase()), dmTitle);

  const dmText = `dm one ${tag()}`;
  await sendChat(pageA, dmText);
  const unreadBadge = await pageB
    .locator('[data-conversation-kind="dm"] [data-unread]')
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  check('B sees an unread badge for the new DM', unreadBadge);

  await pageB.locator('[data-conversation-kind="dm"]').first().click();
  const dmSeen = await pageB
    .getByText(dmText, { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check('B reads the DM', dmSeen);
  await pageB.waitForTimeout(800);
  check(
    'opening the DM clears its unread badge',
    (await pageB.locator('[data-conversation-kind="dm"] [data-unread]').count()) === 0,
  );

  // --- the three-dot menu: edit, unsend, delete for me ------------------
  const dmRow = pageA.locator('[data-message]').filter({ hasText: dmText }).last();
  await dmRow.locator('[data-message-menu]').click();
  await pageA.getByRole('menuitem', { name: 'Edit' }).click();
  await pageA.getByLabel('Edit message').fill(`${dmText} edited`);
  await dmRow.getByRole('button', { name: 'Save', exact: true }).click();
  await pageA.waitForTimeout(900);
  check(
    'B sees the edited message live',
    await pageB.getByText(`${dmText} edited`, { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false),
  );
  check('the edited message is marked as edited', (await pageB.getByText('edited', { exact: true }).count()) >= 1);

  await dmRow.locator('[data-message-menu]').click();
  await pageA.getByRole('menuitem', { name: 'Unsend' }).click();
  await pageA.waitForTimeout(900);
  const unsentSeen = await pageB
    .getByText('Message unsent', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  check('B sees the message was unsent', unsentSeen);
  check('the unsent text is gone for B', (await pageB.getByText(`${dmText} edited`, { exact: false }).count()) === 0);

  // --- forwarding -------------------------------------------------------
  await openPublic(pageA);
  const publicRow = pageA.locator('[data-message]').filter({ hasText: publicText }).last();
  await publicRow.locator('[data-message-menu]').click();
  await pageA.getByRole('menuitem', { name: 'Forward' }).click();
  await pageA.locator('[data-forward-target]').first().click();
  await pageA.waitForTimeout(1200);
  check('A lands in the DM after forwarding', (await pageA.locator('[data-chat-title]').first().innerText()).toLowerCase().includes(userB.toLowerCase()));
  const forwardedLabel = await pageB
    .getByText(/Forwarded from/i)
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  check('B sees the Forwarded label with the original author', forwardedLabel);
  check('B sees the forwarded text', (await pageB.getByText(publicText, { exact: false }).count()) >= 1);

  await pageB.locator('[data-forward-original]').first().click();
  await pageB.waitForTimeout(1200);
  const jumpedTitle = (await pageB.locator('[data-chat-title]').first().innerText()).toLowerCase();
  check('clicking the original opens its conversation', jumpedTitle.includes('public'), jumpedTitle);
  check('the original message is highlighted', (await pageB.locator('[data-message].ring-1').count()) >= 1);

  // --- per-account DM background ---------------------------------------
  await pageA.locator('[data-conversation-kind="dm"]').first().click();
  await pageA.waitForTimeout(600);
  await pageA.getByLabel('Message background').click();
  const editor = pageA.locator('[role="group"][aria-label="Message background"]');
  await editor.locator('button[aria-label="Solid #1f2937"]').click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await pageA.waitForTimeout(1000);
  check('the DM background is applied', (await pageA.locator('[data-chat-background]').getAttribute('data-chat-background')) === 'solid');

  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(1600);
  await dismissNotices(pageA);
  await openTab(pageA, 'chat');
  await pageA.locator('[data-conversation-kind="dm"]').first().click();
  await pageA.waitForTimeout(1200);
  const restored = await pageA.evaluate(() => {
    const layer = document.querySelector('[data-chat-background] > div');
    return layer ? getComputedStyle(layer).backgroundColor : null;
  });
  check('the background is restored after a reload', restored === 'rgb(31, 41, 55)', String(restored));

  // --- groups ------------------------------------------------------------
  await pageA.getByRole('button', { name: 'New group' }).click();
  await pageA.locator('#chat-group-title').fill('Run4 crew');
  await pageA.getByRole('button', { name: 'Create group' }).click();
  await pageA.waitForTimeout(1200);
  check('the new group opens', (await pageA.locator('[data-chat-title]').first().innerText()).includes('Run4 crew'));

  await pageA.getByLabel('Group options').click();
  await pageA.getByRole('menuitem', { name: 'Invite' }).click();
  await pageA.locator('[data-invite]').first().click();
  await pageA.waitForTimeout(1200);
  check('the invited friend joins the group', (await pageB.locator('[data-conversation]').filter({ hasText: 'Run4 crew' }).count()) >= 1);

  await pageB.locator('[data-conversation]').filter({ hasText: 'Run4 crew' }).first().click();
  await pageB.waitForTimeout(700);
  await sendChat(pageB, 'group hello');
  check(
    'A receives the group message live',
    await pageA.getByText('group hello', { exact: false }).first().waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false),
  );

  await pageA.waitForTimeout(900);
  check(
    'an open conversation shows no unread badge',
    (await pageA.locator('[data-conversation]').filter({ hasText: 'Run4 crew' }).locator('[data-unread]').count()) === 0,
  );

  await pageA.getByLabel('Group members').click();
  await pageA.locator('[data-member]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const memberRows = await pageA.locator('[data-member]').count();
  check('the member list shows both accounts', memberRows === 2, String(memberRows));
  await pageA.getByRole('button', { name: 'Close' }).click();

  // --- a stranger sees nothing private ----------------------------------
  await openTab(pageC, 'chat');
  const strangerTitles = await pageC.locator('[data-conversation]').allInnerTexts();
  check('a stranger sees only the public room', strangerTitles.length === 1 && strangerTitles[0].toLowerCase().includes('public'), strangerTitles.join('|'));

  // --- responsive layout ------------------------------------------------
  for (const [width, height] of [[1024, 600], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [390, 844]]) {
    await pageA.setViewportSize({ width, height });
    await pageA.waitForTimeout(450);
    const overflow = await pageA.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal overflow at ${width}x${height}`, overflow <= 1, `${overflow}px`);
  }
  await pageA.setViewportSize({ width: 390, height: 844 });
  await pageA.waitForTimeout(400);
  check('the composer stays reachable on a small screen', await pageA.getByLabel('Message text').isVisible());
  check('the tab row still fits at 390 px', (await pageA.evaluate(() => Math.round(document.querySelector('nav[aria-label="Sections"]').getBoundingClientRect().height))) <= 60);

  await pageA.setViewportSize({ width: 1440, height: 900 });
  await pageA.waitForTimeout(600);
  await pageA.screenshot({ path: '/tmp/run4-chat-1440.png', fullPage: false });
  await pageA.setViewportSize({ width: 390, height: 844 });
  await pageA.waitForTimeout(600);
  await pageA.screenshot({ path: '/tmp/run4-chat-390.png', fullPage: false });

  check('no console errors during the journey', problems.length === 0, problems.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
