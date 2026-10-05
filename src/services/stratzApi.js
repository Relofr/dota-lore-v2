import { getStored, putStored } from './matchStore.js'

const ENDPOINT = 'https://api.stratz.com/graphql'

const HEROES_QUERY = `{
  constants {
    heroes {
      id
      name
      displayName
      shortName
      aliases
      roles {
        roleId
        level
      }
      language {
        lore
        hype
        displayName
      }
      stats {
        primaryAttribute
        attackType
        complexity
        startingDamageMin
        startingDamageMax
        attackRate
        attackRange
        startingArmor
        startingMagicArmor
        hpRegen
        mpRegen
        moveSpeed
        moveTurnRate
        strengthBase
        strengthGain
        agilityBase
        agilityGain
        intelligenceBase
        intelligenceGain
        visionDaytimeRange
        visionNighttimeRange
      }
      abilities {
        slot
        abilityId
      }
    }
    abilities {
      id
      name
      isTalent
      language {
        displayName
        description
        lore
        aghanimDescription
        shardDescription
      }
      stat {
        hasScepterUpgrade
        isGrantedByScepter
        hasShardUpgrade
        isGrantedByShard
        isInnate
        isOnLearnbar
      }
    }
  }
}`



async function stratzQuery(query) {
  const token = import.meta.env.VITE_STRATZ_TOKEN
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const json = await resp.json().catch(() => null)
  if (json?.errors?.length) throw new Error(json.errors.map(e => e.message).join(' | '))
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  return json.data
}

export async function introspectType(typeName) {
  return stratzQuery(`{ __type(name: "${typeName}") { fields { name args { name type { name kind ofType { name } } } type { name kind ofType { name kind } } } } }`)
}

export async function testLiveMatches() {
  return stratzQuery(`{
    live {
      matches(request: { take: 3 }) {
        matchId
        gameState
        gameMinute
        players {
          steamAccountId
          steamAccount { name }
        }
      }
    }
  }`)
}

export async function introspectInput(typeName) {
  return stratzQuery(`{ __type(name: "${typeName}") { inputFields { name type { name kind ofType { name } } } } }`)
}

export async function testLiveArgs() {
  // Try to get the args for live.match via full introspection
  return stratzQuery(`{
    __type(name: "LiveQuery") {
      fields {
        name
        args {
          name
          defaultValue
          type { name kind ofType { name kind } }
        }
      }
    }
  }`)
}

// Session cache of in-flight or settled requests, so revisiting a match or player (back button, history
// links) doesn't hit the API again. Failures are dropped so they can be retried. `limit` evicts the oldest.
function cache(limit = Infinity) {
  const entries = new Map()
  return (key, load) => {
    if (entries.has(key)) {
      const hit = entries.get(key)
      entries.delete(key)
      entries.set(key, hit)
      return hit
    }
    const promise = load().catch(err => {
      entries.delete(key)
      throw err
    })
    entries.set(key, promise)
    if (entries.size > limit) entries.delete(entries.keys().next().value)
    return promise
  }
}

const matchCache = cache(20)
// Playback is ~2 MB per match, so keep only a few.
const playbackCache = cache(3)
const pageCache = cache()

// Item constants barely change between patches, so they're kept in localStorage for a day.
const ITEMS_KEY = 'stratz-items-v1'
const ITEMS_TTL = 24 * 60 * 60 * 1000
let itemsPromise = null

function storedItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(ITEMS_KEY))
    if (saved && Date.now() - saved.at < ITEMS_TTL) return saved.items
  } catch {
    // Unreadable or blocked storage just means fetching again.
  }
  return null
}

export function fetchItems() {
  const saved = storedItems()
  if (saved) return Promise.resolve(new Map(saved.map(i => [i.id, i])))
  itemsPromise ??= stratzQuery(`{
    constants { items { id shortName displayName stat { isRecipe } } }
  }`)
    .then(data => {
      const items = data.constants.items
      try {
        localStorage.setItem(ITEMS_KEY, JSON.stringify({ at: Date.now(), items }))
      } catch {
        // Storage full or blocked; the in-memory promise still covers this session.
      }
      return new Map(items.map(i => [i.id, i]))
    })
    .catch(err => {
      itemsPromise = null
      throw err
    })
  return itemsPromise
}

// A finished, parsed match never changes, so it's kept in the browser (see matchStore.js) and only fetched once.
// `isComplete` guards against storing a match Stratz hasn't finished parsing, which would otherwise stick.
async function storedOrFetched(kind, matchId, load, isComplete) {
  const stored = await getStored(kind, matchId)
  if (stored !== undefined) return stored
  const fresh = await load()
  if (isComplete(fresh)) putStored(kind, matchId, fresh)
  return fresh
}

const parsedMatch = m => m?.didRadiantWin != null && !!m.players?.length && m.players.every(p => p.stats?.networthPerMinute?.length)
const parsedPlayback = players => players.some(p => p.playbackData?.playerUpdateGoldEvents?.length)

// Event-level data for finer-than-a-minute charts; it covers the whole match (~2 MB), so it's loaded separately.
export function fetchMatchPlayback(matchId) {
  return playbackCache(String(matchId), () => storedOrFetched('playback', matchId, () => loadMatchPlayback(matchId), parsedPlayback))
}

async function loadMatchPlayback(matchId) {
  const data = await stratzQuery(`{
    match(id: ${matchId}) {
      players {
        playerSlot
        playbackData {
          playerUpdateGoldEvents { time networth }
          experienceEvents { time amount }
          heroDamageEvents { time value isTargetMainHero toIllusion }
          csEvents { time }
        }
      }
    }
  }`)
  return data.match?.players ?? []
}

export function fetchMatchPlayers(matchId) {
  return matchCache(String(matchId), () => storedOrFetched('match', matchId, () => loadMatchPlayers(matchId), parsedMatch))
}

async function loadMatchPlayers(matchId) {
  const data = await stratzQuery(`{
    match(id: ${matchId}) {
      id
      startDateTime
      durationSeconds
      didRadiantWin
      topLaneOutcome
      midLaneOutcome
      bottomLaneOutcome
      firstBloodTime
      radiantNetworthLeads
      radiantExperienceLeads
      radiantKills
      direKills
      towerDeaths { time isRadiant }
      players {
        steamAccountId
        playerSlot
        isRadiant
        heroId
        item0Id
        item1Id
        item2Id
        item3Id
        item4Id
        item5Id
        backpack0Id
        backpack1Id
        backpack2Id
        neutral0Id
        kills
        deaths
        assists
        numLastHits
        numDenies
        goldPerMinute
        experiencePerMinute
        networth
        level
        heroDamage
        lane
        position
        stats {
          lastHitsPerMinute
          deniesPerMinute
          goldPerMinute
          experiencePerMinute
          networthPerMinute
          heroDamagePerMinute
          level
          killEvents { time target isSolo isGank }
          deathEvents { time attacker goldFed timeDead }
          assistEvents { time }
          itemPurchases { time itemId }
        }
        hero {
          displayName
          shortName
        }
        steamAccount {
          id
          name
          avatar
        }
      }
    }
  }`)
  return data.match ?? null
}

export async function fetchLiveMatch(matchId) {
  const data = await stratzQuery(`{
    live {
      match(id: ${matchId}) {
        matchId
        gameState
        gameTime
        gameMinute
        players {
          steamAccountId
          heroId
          isRadiant
          numKills
          numDeaths
          numAssists
          networth
          goldPerMinute
          experiencePerMinute
          steamAccount {
            id
            name
            avatar
          }
          hero {
            displayName
            shortName
          }
        }
      }
    }
  }`)
  return data.live?.match ?? null
}

const RANKED_LOBBY = 7

export function fetchPlayerMatches(steamAccountId, skip, take = 10) {
  return pageCache(`matches:${steamAccountId}:${skip}:${take}`, () => loadPlayerMatches(steamAccountId, skip, take))
}

async function loadPlayerMatches(steamAccountId, skip, take) {
  const data = await stratzQuery(`{
    player(steamAccountId: ${steamAccountId}) {
      matches(request: { take: ${take}, skip: ${skip}, lobbyTypeIds: [${RANKED_LOBBY}] }) {
        id
        didRadiantWin
        durationSeconds
        startDateTime
        players(steamAccountId: ${steamAccountId}) {
          isRadiant
          heroId
          kills
          deaths
          assists
          position
          hero { displayName shortName }
        }
      }
    }
  }`)
  return data.player?.matches ?? []
}

export const PERIOD_PAGE_SIZE = 100

function threeMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return Math.floor(d.getTime() / 1000)
}

const periodFields = id => `
        didRadiantWin
        players(steamAccountId: ${id}) {
          isRadiant
          heroId
          hero { displayName shortName }
        }`

export function fetchRankedPeriodPage(steamAccountId, skip) {
  return pageCache(`period:${steamAccountId}:${skip}`, () => loadRankedPeriodPage(steamAccountId, skip))
}

async function loadRankedPeriodPage(steamAccountId, skip) {
  const data = await stratzQuery(`{
    player(steamAccountId: ${steamAccountId}) {
      matches(request: { startDateTime: ${threeMonthsAgo()}, take: ${PERIOD_PAGE_SIZE}, skip: ${skip}, lobbyTypeIds: [${RANKED_LOBBY}] }) {${periodFields(steamAccountId)}
      }
    }
  }`)
  return data.player?.matches ?? []
}

// Per-player promises; the settled objects are shared with the page, so pages appended to them later stay cached.
const playerCache = new Map()

// One batched request covering only the players not already cached.
export async function fetchPlayersData(steamAccountIds) {
  const missing = steamAccountIds.filter(id => !playerCache.has(id))
  if (missing.length) {
    const batch = loadPlayersData(missing)
    for (const id of missing) playerCache.set(id, batch.then(result => result[id]))
    batch.catch(() => { for (const id of missing) playerCache.delete(id) })
  }
  const result = {}
  await Promise.all(steamAccountIds.map(async id => { result[id] = await playerCache.get(id) }))
  return result
}

async function loadPlayersData(steamAccountIds) {
  const since = threeMonthsAgo()
  const blocks = steamAccountIds.map(id => `
    p${id}: player(steamAccountId: ${id}) {
      steamAccount { name avatar isAnonymous seasonRank seasonLeaderboardRank }
      anyMatch: matches(request: { take: 1 }) { id }
      recentPeriod: matches(request: { startDateTime: ${since}, take: ${PERIOD_PAGE_SIZE}, lobbyTypeIds: [${RANKED_LOBBY}] }) {${periodFields(id)}
      }
      matches(request: { take: 10, lobbyTypeIds: [${RANKED_LOBBY}] }) {
        id
        didRadiantWin
        durationSeconds
        startDateTime
        players(steamAccountId: ${id}) {
          isRadiant
          heroId
          kills
          deaths
          assists
          position
          hero { displayName shortName }
        }
      }
    }`).join('\n')
  const data = await stratzQuery(`{ ${blocks} }`)
  const result = {}
  for (const id of steamAccountIds) result[id] = data[`p${id}`] ?? null
  return result
}

export async function fetchStratzHeroes() {
  const token = import.meta.env.VITE_STRATZ_TOKEN
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: HEROES_QUERY }),
  })

  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  const json = await resp.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data.constants
}
