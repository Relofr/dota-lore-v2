import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SOURCES = [
  'https://raw.githubusercontent.com/SteamDatabase/GameTracking-Dota2/master/game/dota/resource/dota_english.txt',
  'https://raw.githubusercontent.com/SteamDatabase/GameTracking-Dota2/main/game/dota/resource/dota_english.txt',
]

async function tryFetch(urls) {
  for (const url of urls) {
    try {
      process.stdout.write(`Fetching ${url} ... `)
      const res = await fetch(url)
      if (res.ok) {
        console.log(`OK (${res.headers.get('content-length') ?? '?'} bytes)`)
        return res.text()
      }
      console.log(`${res.status} ${res.statusText}`)
    } catch (err) {
      console.log(err.message)
    }
  }
  throw new Error('All sources failed — check network or update SOURCES URLs in scripts/fetch-lore.js')
}

function parseLore(text) {
  const loreMap = {}
  // Valve KeyValues format: "npc_dota_hero_<key>_lore"   "<lore text>"
  const pattern = /"npc_dota_hero_(\w+)_lore"\s+"((?:[^"\\]|\\.)*)"/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const key = match[1]
    const lore = match[2]
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
    loreMap[key] = lore
  }
  return loreMap
}

async function main() {
  const text = await tryFetch(SOURCES)
  const loreMap = parseLore(text)
  const count = Object.keys(loreMap).length

  if (count === 0) {
    throw new Error('No lore strings found — the file format may have changed')
  }

  console.log(`Parsed ${count} hero lore entries`)

  const out = {
    _updated: new Date().toISOString(),
    _source: 'SteamDatabase/GameTracking-Dota2 — game/dota/resource/dota_english.txt',
    heroes: loreMap,
  }

  const outPath = resolve(__dirname, '../src/data/officialLore.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`Written → ${outPath}`)
}

main().catch(err => {
  console.error('fetch-lore failed:', err.message)
  process.exit(1)
})
