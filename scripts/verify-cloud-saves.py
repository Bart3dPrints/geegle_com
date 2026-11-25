#!/usr/bin/env python3
"""Browser verification for per-account game storage and cloud-save adapters.

Runs against the local dev server (Vite), so it exercises the real game
wrappers, the storage shim and the IndexedDB serializer in Chromium.

    /tmp/venv/bin/python scripts/verify-cloud-saves.py [base-url] [game-path]
"""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"
GAME = sys.argv[2] if len(sys.argv) > 2 else "/games/clScamptonTheGreatFightRecreate.html"
A = "11111111-2222-3333-4444-555555555555"
B = "99999999-8888-7777-6666-555555555555"


async def main():
    out = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await (await browser.new_context()).new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        await page.goto(f"{BASE}{GAME}?geegle_profile={A}", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        out["shim_present"] = await page.evaluate("Boolean(document.querySelector('script[data-geegle-storage]'))")
        out["shim_game_id"] = await page.evaluate("document.querySelector('script[data-geegle-storage]').dataset.game")
        await page.evaluate("localStorage.setItem('saveSlot', 'level-4')")
        out["shim_read"] = await page.evaluate("localStorage.getItem('saveSlot')")

        # The app shell does not load the shim, so it sees the real backing store.
        await page.goto(f"{BASE}/", wait_until="domcontentloaded")
        out["raw_keys_after_a"] = await page.evaluate("Object.keys(localStorage)")

        await page.goto(f"{BASE}{GAME}?geegle_profile={B}", wait_until="domcontentloaded")
        await page.wait_for_timeout(800)
        out["b_initial_slot"] = await page.evaluate("localStorage.getItem('saveSlot')")
        await page.evaluate("localStorage.setItem('saveSlot', 'level-1')")
        await page.goto(f"{BASE}{GAME}?geegle_profile={A}", wait_until="domcontentloaded")
        await page.wait_for_timeout(800)
        out["a_slot_again"] = await page.evaluate("localStorage.getItem('saveSlot')")

        await page.goto(f"{BASE}{GAME}", wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        await page.evaluate("localStorage.setItem('guestOnly', 'raw')")
        out["guest_raw"] = await page.evaluate("localStorage.getItem('guestOnly')")

        await page.goto(f"{BASE}/", wait_until="networkidle")
        out["adapter"] = await page.evaluate(
            f"""
            (async () => {{
              const adapters = await import('/src/lib/saveAdapters.ts');
              const spec = adapters.adapterFor('capturedGame', '{GAME}');
              const captured = await spec.capture('{A}');
              const other = await spec.capture('{B}');
              await spec.restore('{A}', {{ format: 'geegle-storage-v2', localStorage: {{ saveSlot: 'restored-9' }}, indexedDB: [] }});
              const after = await spec.capture('{A}');
              const untouched = await spec.capture('{B}');
              return {{ captured, other, after, untouched, launch: spec.launchPath('{A}'), supported: Boolean(spec) }};
            }})()
            """
        )

        out["indexeddb"] = await page.evaluate(
            """
            (async () => {
              const mod = await import('/src/lib/storageSnapshot.ts');
              await new Promise((resolve, reject) => {
                const req = indexedDB.open('geegle-verify-db', 3);
                req.onupgradeneeded = () => {
                  const db = req.result;
                  const store = db.createObjectStore('saves', { keyPath: 'id' });
                  store.createIndex('byLevel', 'level', { unique: false });
                  db.createObjectStore('manual', { autoIncrement: true });
                };
                req.onsuccess = () => { req.result.close(); resolve(); };
                req.onerror = () => reject(req.error);
              });
              await new Promise((resolve, reject) => {
                const req = indexedDB.open('geegle-verify-db');
                req.onsuccess = () => {
                  const db = req.result;
                  const tx = db.transaction(['saves', 'manual'], 'readwrite');
                  tx.objectStore('saves').put({ id: 'slot1', level: 12,
                    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'x/test' }),
                    bytes: new Uint8Array([9, 8, 7]),
                    when: new Date('2026-01-02T00:00:00Z'),
                    nested: { list: [1, 2, { deep: true }] } });
                  tx.objectStore('manual').put({ note: 'out-of-line key' }, 41);
                  tx.oncomplete = () => { db.close(); resolve(); };
                  tx.onerror = () => reject(tx.error);
                };
              });
              const dump = await mod.dumpDatabase('geegle-verify-db');
              await new Promise((resolve) => { const r = indexedDB.deleteDatabase('geegle-verify-db'); r.onsuccess = resolve; r.onerror = resolve; });
              await mod.restoreDatabase(dump);
              const check = await new Promise((resolve, reject) => {
                const req = indexedDB.open('geegle-verify-db');
                req.onsuccess = () => {
                  const db = req.result;
                  const tx = db.transaction(['saves', 'manual'], 'readonly');
                  const result = { version: db.version, stores: [...db.objectStoreNames] };
                  const saveReq = tx.objectStore('saves').get('slot1');
                  const manualReq = tx.objectStore('manual').get(41);
                  tx.oncomplete = async () => {
                    const record = saveReq.result;
                    result.record = { level: record.level, nested: record.nested,
                      date: record.when.toISOString(), isBlob: record.blob instanceof Blob,
                      isTyped: record.bytes instanceof Uint8Array };
                    result.blobBytes = [...new Uint8Array(await record.blob.arrayBuffer())];
                    result.typedBytes = [...record.bytes];
                    result.outOfLine = manualReq.result;
                    result.indexes = [...db.transaction('saves').objectStore('saves').indexNames];
                    db.close();
                    resolve(result);
                  };
                  tx.onerror = () => reject(tx.error);
                };
                req.onerror = () => reject(req.error);
              });
              await new Promise((resolve) => { const r = indexedDB.deleteDatabase('geegle-verify-db'); r.onsuccess = resolve; r.onerror = resolve; });
              return { ...check, dumpStores: dump.stores.map(s => ({ name: s.name, autoIncrement: s.autoIncrement, records: s.records.length })) };
            })()
            """
        )
        out["pageerrors"] = errors
        await browser.close()
    print(json.dumps(out, indent=2))

asyncio.run(main())
