#!/usr/bin/env node
/**
 * Internet image search acquisition (primary method).
 *
 * For every unprocessed catalog id this queries Bing Images with the exact
 * title plus "game", keeps the first few usable results and downloads them to
 * a staging directory for visual review. It never launches a game, a browser
 * engine or a renderer, so it costs no GPU/WebGL work.
 *
 *   node scripts/artwork/search-images.mjs --limit 100 --out /tmp/isearch
 *   node scripts/artwork/search-images.mjs --ids clhobo3,cl10bullets --out /tmp/isearch
 *
 * Writes <out>/index.json: id -> { title, query, candidates[] } where every
 * candidate carries the image URL, its source page and the saved file. A later
 * review step decides which candidate becomes the card artwork.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PROGRESS = path.join(ROOT, 'scripts', 'artwork', 'progress.json')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const LIMIT = Number(opt('limit', 100))
const OUT = path.resolve(opt('out', '/tmp/isearch'))
const WANTED = opt('ids', '') ? opt('ids', '').split(',').filter(Boolean) : null
const CONCURRENCY = Number(opt('concurrency', 4))
const PER_QUERY = Number(opt('per-query', 5))

fs.mkdirSync(OUT, { recursive: true })

const progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'))
// Titles whose first results held no identifiable, unwatermarked artwork are
// not searched again; their reason lives in scripts/artwork/no-artwork.json.
const SKIP_FILE = path.join(ROOT, 'scripts', 'artwork', 'no-artwork.json')
const skip = fs.existsSync(SKIP_FILE) ? Object.keys(JSON.parse(fs.readFileSync(SKIP_FILE, 'utf8'))) : []
let queue = progress.entries.filter((e) => e.status === 'not-started' && !skip.includes(e.id))
if (WANTED) {
  const set = new Set(WANTED)
  queue = queue.filter((e) => set.has(e.id))
}
queue = queue.slice(0, LIMIT)

const indexFile = path.join(OUT, 'index.json')
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {}

const unescape = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

async function get(url, extra = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', ...extra },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res
}

/** Search Bing Images and return candidate records in ranked order. */
async function search(query) {
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=1&count=30&mmasync=1&adlt=off`
  const html = await (await get(url, { Referer: 'https://www.bing.com/images/search' })).text()
  const out = []
  // Each result is one <a class="iusc" m="{...murl, purl, t...}">
  const blocks = html.split('class="iusc"').slice(1)
  for (const block of blocks) {
    const m = block.match(/m="([^"]+)"/)
    if (!m) continue
    let meta
    try {
      meta = JSON.parse(unescape(m[1]))
    } catch {
      continue
    }
    if (!meta.murl) continue
    out.push({
      imageUrl: meta.murl,
      pageUrl: meta.purl || '',
      name: meta.t || '',
      width: Number(meta.mw) || null,
      height: Number(meta.mh) || null,
    })
    if (out.length >= 12) break
  }
  return out
}

async function download(url, file, referer) {
  const res = await get(url, referer ? { Referer: referer } : {})
  const type = res.headers.get('content-type') || ''
  if (!/^image\//.test(type)) throw new Error(`not an image (${type})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 8000) throw new Error(`too small (${buf.length}B)`)
  fs.writeFileSync(file, buf)
  return buf.length
}

async function handle(entry) {
  const dir = path.join(OUT, entry.id)
  fs.mkdirSync(dir, { recursive: true })
  const query = `${entry.title} game`
  let found
  try {
    found = await search(query)
  } catch (err) {
    index[entry.id] = { title: entry.title, query, error: `search: ${err.message}`, candidates: [] }
    return index[entry.id]
  }
  const candidates = []
  for (const c of found) {
    if (candidates.length >= PER_QUERY) break
    const ext = (path.extname(new URL(c.imageUrl).pathname) || '.img').toLowerCase().slice(0, 5)
    const file = path.join(dir, `${String(candidates.length + 1).padStart(2, '0')}${ext}`)
    try {
      const bytes = await download(c.imageUrl, file, c.pageUrl)
      candidates.push({ ...c, file: path.relative(OUT, file), bytes })
    } catch {
      // Host refused the download; try the next result.
    }
  }
  index[entry.id] = { title: entry.title, query, candidates }
  return index[entry.id]
}

let done = 0
let next = 0
const save = () => fs.writeFileSync(indexFile, JSON.stringify(index, null, 1))

async function worker() {
  while (next < queue.length) {
    const entry = queue[next++]
    try {
      await handle(entry)
    } catch (err) {
      index[entry.id] = { title: entry.title, query: `${entry.title} game`, error: String(err), candidates: [] }
    }
    done += 1
    if (done % 10 === 0) {
      save()
      const withArt = Object.values(index).filter((v) => v.candidates?.length).length
      console.log(`${done}/${queue.length} searched, ${withArt} with images`)
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
save()
const withArt = Object.values(index).filter((v) => v.candidates?.length).length
console.log(`done: ${queue.length} titles, ${withArt} with downloaded candidates -> ${indexFile}`)
