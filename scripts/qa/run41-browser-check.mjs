// Run 4.1 browser acceptance: the corrected presence counter, the Friends empty
// state, bubble alignment and menu placement, stable empty conversations,
// unread indicators, pinned conversations, forwarding references and the
// site-wide theme. Drives the real app against the local Supabase stack.
//
// Usage: `npm run dev -- --mode qa --port 5173`, then
// `bun scripts/qa/run41-browser-check.mjs`.

import { chromium } from '@playwright/test';

const BASE = process.env.GEEGLE_BASE ?? 'http://127.0.0.1:5173';
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

const tag = () => `${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 1e4)}`;
const password = 'Chat-check-1';

async function dismissNotices(page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator('div.fixed.inset-0.z-50').first();
    const appeared = await overlay.waitFor({ state: 'visible', timeout: 1200 }).then(() => true).catch(() => false);
    if (!appeared) return;
    const buttons = overlay.locator('button');
    if ((await buttons.count()) === 0) return;
    await buttons.last().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function openLibrary(page) {
  await page.goto(`${BASE}/#games`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
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
  await page.waitForTimeout(450);
  await dismissNotices(page);
}

async function send(page, text) {
  const field = page.getByLabel('Message text');
  await field.waitFor({ state: 'visible', timeout: 10000 });
  await field.fill(text);
  await page.getByLabel('Send message').click();
  await page.waitForTimeout(700);
}

const presence = (page) => page.evaluate(() => {
  const box = document.querySelector('[data-visitors]');
  const dot = document.querySelector('[data-presence-dot]');
  return {
    title: box?.getAttribute('title') ?? '',
    text: (box?.textContent ?? '').trim(),
    state: dot?.getAttribute('data-presence-dot') ?? 'missing',
    count: box?.getAttribute('data-visitors') ?? 'missing',
  };
});

const browser = await chromium.launch();

try {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const guest = await ctxGuest.newPage();
  const problems = [];
  for (const [label, page] of [['A', pageA], ['B', pageB], ['guest', guest]]) {
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`${label}: ${m.text().slice(0, 160)}`);
    });
    page.on('pageerror', (e) => problems.push(`${label}: ${String(e).slice(0, 160)}`));
  }

  const userA = `r41a${tag()}`;
  const userB = `r41b${tag()}`;

  // --- presence -----------------------------------------------------------
  await openLibrary(guest);
  await openLibrary(pageA);
  await openLibrary(pageB);
  await guest.waitForTimeout(1200);
  const guestPresence = await presence(guest);
  check('guest sees a live visitor count', guestPresence.state === 'live' && guestPresence.count !== 'unavailable', `${guestPresence.text} ${guestPresence.title}`);

  check('account A registers', await register(pageA, userA));
  check('account B registers', await register(pageB, userB));
  await pageA.waitForTimeout(2500);
  const signedIn = await presence(pageA);
  check('signed-in visitor count is real, not a dash', signedIn.state === 'live' && signedIn.count !== 'unavailable', `${signedIn.text} ${signedIn.title}`);

  // --- friends ------------------------------------------------------------
  await openTab(pageA, 'friends');
  await pageA.getByLabel('Search accounts by username').fill(userB);
  await pageA.waitForSelector('[data-search-result]', { timeout: 10000 });
  await pageA.locator('[data-search-result]').first().getByRole('button', { name: 'Add' }).click();
  await pageA.waitForTimeout(700);
  await openTab(pageB, 'friends');
  await pageB.locator('[data-incoming]').first().getByRole('button', { name: 'Accept' }).click();
  await pageB.waitForTimeout(900);
  await openTab(pageA, 'friends');
  await pageA.waitForTimeout(800);
  check('an accepted friend removes the empty state', (await pageA.getByText('No friends yet', { exact: false }).count()) === 0);
  check('the invisible-mode control is gone', (await pageA.getByText('Show me online', { exact: false }).count()) === 0 && (await pageA.getByRole('checkbox', { name: /online/i }).count()) === 0);

  // --- public chat bubbles ----------------------------------------------
  await openTab(pageA, 'chat');
  await pageA.locator('[data-conversation-kind="public"]').first().click();
  await pageA.waitForTimeout(400);
  await send(pageA, `hello r41 ${tag()}`);
  await openTab(pageB, 'chat');
  await pageB.locator('[data-conversation-kind="public"]').first().click();
  await pageB.waitForTimeout(900);
  await send(pageB, `reply r41 ${tag()}`);
  await pageA.waitForTimeout(1200);

  const geometry = await pageA.evaluate(() => {
    const bubbles = [...document.querySelectorAll('[data-bubble]')].slice(-6);
    return bubbles.map((bubble) => {
      const row = bubble.closest('[data-mine]');
      const menu = row?.querySelector('[data-message-menu]');
      const b = bubble.getBoundingClientRect();
      const m = menu?.getBoundingClientRect();
      const container = bubble.closest('[data-chat-surface]')?.getBoundingClientRect();
      return {
        side: bubble.getAttribute('data-bubble'),
        left: bubble.getBoundingClientRect().left,
        right: bubble.getBoundingClientRect().right,
        width: b.width,
        containerWidth: container?.width ?? 0,
        containerLeft: container?.left ?? 0,
        containerRight: container?.right ?? 0,
        menuGapLeft: m ? Math.round(b.left - m.right) : null,
        menuGapRight: m ? Math.round(m.left - b.right) : null,
        background: getComputedStyle(bubble).backgroundColor,
        mine: row?.getAttribute('data-mine'),
      };
    });
  });
  const outgoing = geometry.filter((g) => g.side === 'out');
  const incoming = geometry.filter((g) => g.side === 'in');
  check('outgoing bubbles sit against the right edge', outgoing.length > 0 && outgoing.every((g) => g.containerRight - g.right < 80), outgoing.map((g) => Math.round(g.containerRight - g.right)).join(','));
  check('incoming bubbles sit against the left edge', incoming.length > 0 && incoming.every((g) => g.left - g.containerLeft < 80), incoming.map((g) => Math.round(g.left - g.containerLeft)).join(','));
  check('short bubbles stay narrow', [...outgoing, ...incoming].every((g) => g.width < g.containerWidth * 0.78), [...outgoing, ...incoming].map((g) => `${Math.round(g.width)}/${Math.round(g.containerWidth)}`).join(' '));
  check('outgoing default bubble is blue', outgoing.every((g) => { const m = g.background.match(/\d+/g) ?? []; return Number(m[2]) > 120 && Number(m[2]) - Number(m[0]) > 40; }), outgoing[0]?.background);
  check('incoming default bubble is neutral gray', incoming.every((g) => { const m = g.background.match(/\d+/g) ?? []; const [r, g2, b] = m.slice(0, 3).map(Number); return Math.max(r, g2, b) - Math.min(r, g2, b) < 30; }), incoming[0]?.background);

  // menu placement, via hover on a known message row
  const row = pageA.locator('[data-mine="true"]').last();
  await row.hover();
  await pageA.waitForTimeout(250);
  const menuBox = await row.locator('[data-message-menu]').boundingBox();
  const bubbleBox = await row.locator('[data-bubble]').boundingBox();
  check('the outgoing menu sits immediately left of its bubble', menuBox && bubbleBox && bubbleBox.x - (menuBox.x + menuBox.width) >= 0 && bubbleBox.x - (menuBox.x + menuBox.width) <= 12, `${menuBox && bubbleBox ? Math.round(bubbleBox.x - (menuBox.x + menuBox.width)) : 'n/a'}px`);
  await row.getByLabel('Account').first().count().catch(() => {});
  await pageA.mouse.move(5, 5);
  await pageA.waitForTimeout(200);
  const bubbleHidden = await pageA.locator('[data-mine="true"]').last().locator('[data-bubble]').boundingBox();
  check('showing the menu does not move the bubble', bubbleHidden && bubbleBox && Math.abs(bubbleHidden.x - bubbleBox.x) < 1 && Math.abs(bubbleHidden.y - bubbleBox.y) < 1);

  // --- empty conversation without flicker -------------------------------
  await pageA.getByRole('button', { name: /new message|new dm/i }).first().click().catch(() => {});
  await pageA.waitForTimeout(300);
  const pickerVisible = await pageA.locator('[data-picker]').count();
  if (pickerVisible) {
    await pageA.locator('[data-picker] [data-start-dm]').first().click();
  } else {
    await pageA.keyboard.press('Escape');
  }
  await pageA.waitForTimeout(300);
  const dmRow = pageA.locator('[data-conversation-kind="dm"]').first();
  if (await dmRow.count()) await dmRow.click();
  await pageA.waitForTimeout(600);
  const samples = [];
  for (let i = 0; i < 12; i += 1) {
    samples.push(await pageA.evaluate(() => {
      const text = document.querySelector('[data-chat-surface]')?.textContent ?? '';
      return { loading: /Loading messages/i.test(text), empty: /No messages yet\./.test(text) };
    }));
    await pageA.waitForTimeout(220);
  }
  check('an empty conversation never says "Loading messages"', samples.every((sample) => !sample.loading));
  check('an empty conversation says "No messages yet." and keeps saying it', samples.filter((sample) => sample.empty).length >= 8, `${samples.filter((sample) => sample.empty).length}/12`);

  // --- unread indicators ------------------------------------------------
  await openTab(pageB, 'games');
  await pageB.waitForTimeout(500);
  await pageA.locator('[data-conversation-kind="public"]').first().click();
  await pageA.waitForTimeout(400);
  await send(pageA, `public ping ${tag()}`);
  await pageB.waitForTimeout(1800);
  const badge = await pageB.evaluate(() => {
    const el = document.querySelector('[data-chat-badge]');
    return { kind: el?.getAttribute('data-chat-badge') ?? 'none', text: el?.textContent?.trim() ?? '' };
  });
  check('public-only unread shows a dot, not a number', badge.kind === 'dot', JSON.stringify(badge));

  await pageA.locator('[data-conversation-kind="dm"]').first().click();
  await pageA.waitForTimeout(500);
  await send(pageA, `dm ping ${tag()}`);
  await send(pageA, `dm ping two ${tag()}`);
  await pageB.waitForTimeout(1900);
  const badge2 = await pageB.evaluate(() => {
    const el = document.querySelector('[data-chat-badge]');
    return { kind: el?.getAttribute('data-chat-badge') ?? 'none', text: el?.textContent?.trim() ?? '' };
  });
  check('private unread shows a numeric badge that wins over the dot', badge2.kind === 'count' && /^\d+\+?$/.test(badge2.text), JSON.stringify(badge2));

  // --- pins -------------------------------------------------------------
  const orderBefore = await pageA.locator('[data-conversation]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-conversation-kind')));
  check('public chat is first in the sidebar', orderBefore[0] === 'public', orderBefore.join(','));
  const pinButton = pageA.locator('[data-pin]').first();
  await pinButton.click({ force: true });
  await pageA.waitForTimeout(1200);
  const pinned = await pageA.locator('[data-conversation]').evaluateAll((rows) => rows.map((r) => ({ kind: r.getAttribute('data-conversation-kind'), pinned: r.getAttribute('data-pinned') })));
  check('a pinned conversation moves directly below public chat', pinned[0]?.kind === 'public' && pinned[1]?.pinned === 'true', JSON.stringify(pinned));
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2200);
  await dismissNotices(pageA);
  await openTab(pageA, 'chat');
  await pageA.waitForTimeout(800);
  const afterReload = await pageA.locator('[data-conversation]').evaluateAll((rows) => rows.map((r) => ({ kind: r.getAttribute('data-conversation-kind'), pinned: r.getAttribute('data-pinned') })));
  check('the pin survives a reload', afterReload[0]?.kind === 'public' && afterReload[1]?.pinned === 'true', JSON.stringify(afterReload));

  // --- forwarding reference --------------------------------------------
  const publicRow = pageA.locator('[data-conversation-kind="public"]').first();
  await publicRow.click();
  await pageA.waitForTimeout(600);
  const minePublic = pageA.locator('[data-mine="true"] [data-bubble]').last();
  await minePublic.hover();
  await pageA.locator('[data-mine="true"]').last().locator('[data-message-menu]').click();
  await pageA.getByRole('menuitem', { name: /forward/i }).click().catch(async () => {
    await pageA.getByRole('button', { name: /forward/i }).last().click();
  });
  await pageA.waitForTimeout(700);
  await pageA.locator('[data-forward-target]').first().click();
  await pageA.waitForTimeout(1400);
  check('forwarding lands in the chosen conversation', (await pageA.locator('[data-forwarded]').count()) >= 1);

  // --- moderation is not offered to ordinary accounts -------------------
  check('ordinary accounts see no moderation tools', (await pageA.locator('[data-moderation-open]').count()) === 0);

  // --- theme ------------------------------------------------------------
  await pageA.locator('button[aria-label="Settings"]').click();
  await pageA.waitForTimeout(600);
  await pageA.locator('[data-theme-preset="purple"]').click();
  await pageA.waitForTimeout(800);
  const themed = await pageA.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      bg: styles.getPropertyValue('--geegle-bg').trim(),
      header: styles.getPropertyValue('--geegle-header').trim(),
      accent: styles.getPropertyValue('--geegle-accent').trim(),
      card: styles.getPropertyValue('--geegle-card').trim(),
    };
  });
  check('a preset recolours every surface, not just the accent', /268|275|purple/i.test(themed.bg.split(' ')[0]) || themed.bg !== themed.card, JSON.stringify(themed));
  await pageA.keyboard.press('Escape');
  await pageA.waitForTimeout(500);
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.waitForTimeout(2400);
  await dismissNotices(pageA);
  const persisted = await pageA.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--geegle-bg').trim());
  check('the chosen theme persists across a reload', persisted === themed.bg, `${persisted} vs ${themed.bg}`);

  // --- sign out keeps presence alive ------------------------------------
  await pageA.getByLabel('Account').first().click();
  await pageA.waitForTimeout(400);
  await pageA.getByRole('button', { name: /sign out/i }).click().catch(() => {});
  await pageA.waitForTimeout(2500);
  const afterSignOut = await presence(pageA);
  check('the visitor count still works after signing out', afterSignOut.state === 'live' && afterSignOut.count !== 'unavailable', `${afterSignOut.text} ${afterSignOut.title}`);

  check('no console errors during the journey', problems.length === 0, problems.slice(0, 4).join(' | '));
} finally {
  await browser.close();
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
