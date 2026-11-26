#!/usr/bin/env node
// Low-rate reachability and identity check for every configured proxy server.
//
// Ordinary GET requests only, no filtering evasion, no credentials. Records the
// HTTP status, final URL, content type, title (when HTML), and whether the
// provider refuses framing. A 200 alone is never treated as "verified": the
// identity fields have to look like the provider's own page.
//
// Output: docs/qa/proxy-endpoints.json
// Run: node scripts/qa/check-proxies.mjs

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

// Read the runtime list itself so the audit can never drift from what ships.
const source = readFileSync('src/data/proxies.ts', 'utf8');
const PROXY_SERVICES = [];
for (const block of source.split(/\n  \{\n    id: '/).slice(1)) {
  const id = block.slice(0, block.indexOf("'"));
  const name = block.match(/name: '([^']+)'/)?.[1];
  const endpoints = [...block.matchAll(/remote\('([^']+)', '([^']+)'\)|local\('([^']+)', '([^']+)'\)/g)].map(
    (match) => ({
      label: match[1] ?? match[3],
      url: match[2] ?? match[4],
      verified: Boolean(match[3]),
    }),
  );
  if (id && name) PROXY_SERVICES.push({ id, name, endpoints });
}

const results = [];
const TIMEOUT_MS = 15_000;

async function check(service, endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(endpoint.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GeegleLinkCheck/1.0)' },
    });
    const type = response.headers.get('content-type') ?? '';
    let title = null;
    let identity = null;
    if (type.includes('html')) {
      const body = (await response.text()).slice(0, 60_000);
      title = body.match(/<title[^>]*>([^<]{1,160})<\/title>/i)?.[1]?.trim() ?? null;
      identity = body
        .match(/<meta[^>]+(?:application-name|og:site_name)[^>]+content=["']([^"']{1,80})["']/i)?.[1]
        ?.trim() ?? null;
    }
    return {
      service: service.id,
      provider: service.name,
      label: endpoint.label,
      url: endpoint.url,
      status: response.status,
      finalUrl: response.url,
      contentType: type.split(';')[0],
      title,
      identity,
      frameBlocked: Boolean(
        response.headers.get('x-frame-options') ||
          /frame-ancestors/i.test(response.headers.get('content-security-policy') ?? ''),
      ),
    };
  } catch (error) {
    return {
      service: service.id,
      provider: service.name,
      label: endpoint.label,
      url: endpoint.url,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const queue = PROXY_SERVICES.flatMap((service) => service.endpoints.map((endpoint) => ({ service, endpoint })));
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const item = queue[cursor++];
    results.push(await check(item.service, item.endpoint));
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

results.sort((a, b) => a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label, undefined, { numeric: true }));
mkdirSync('docs/qa', { recursive: true });
writeFileSync(
  'docs/qa/proxy-endpoints.json',
  JSON.stringify({ checkedAt: new Date().toISOString(), expectedTotal: queue.length, results }, null, 2) + '\n',
);

const reachable = results.filter((result) => result.status && result.status < 400).length;
const blocked = results.filter((result) => result.status === 403 || result.status === 401).length;
console.log(`${results.length} endpoints, ${reachable} returned < 400, ${blocked} returned 401/403`);
for (const result of results) {
  console.log(
    `${result.status ?? 'ERR'} ${result.provider} ${result.label} ${result.frameBlocked ? '[framing blocked]' : ''} ${result.title ?? result.error ?? ''}`.slice(0, 160),
  );
}
