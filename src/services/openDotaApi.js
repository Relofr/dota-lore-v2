// OpenDota as a backup for Stratz: when Stratz is slow, down, or hasn't parsed a match yet, the same data
// is read from OpenDota and converted into the shapes the Stratz queries return, so the views don't care
// where it came from. OpenDota's free tier allows ~60 calls a minute per user, so it's only used as a fallback.
import { getStored, putStored } from './matchStore.js'

const API = 'https://api.opendota.com/api'
const CONSTANTS_TTL = 7 * 24 * 60 * 60 * 1000

async function odGet(path) {
  const resp = await fetch(`${API}${path}`)
  if (!resp.ok) throw new Error(`OpenDota returned ${resp.status}`)
  return resp.json()
}

// Hero and item lists change only with patches, so they're kept in localStorage for a week.
const constantsPromises = {}
function constants(name, build) {
  const key = `opendota-${name}`
  constantsPromises[name] ??= (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      if (saved && Date.now() - saved.at < CONSTANTS_TTL) return saved.value
    } catch {
      // Unreadable storage just means fetching again.
    }
    const value = build(await odGet(`/constants/${name}`))
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }))
    } catch {
      // Storage full or blocked; the in-memory promise still covers this session.
    }
    return value
  })().catch(err => {
    delete constantsPromises[name]
    throw err
  })
  return constantsPromises[name]
}

// { [heroId]: { displayName, shortName } }, shortName as in Stratz ('antimage'), for hero images.
const heroConstants = () => constants('heroes', raw => Object.fromEntries(Object.values(raw).map(h => [
  h.id,
  { displayName: h.localized_name, shortName: h.name.replace('npc_dota_hero_', '') },
])))

// { [itemId]: shortName }, e.g. { 1: 'blink' }.
const itemConstants = () => constants('item_ids', raw => raw)

// Items in the shape Stratz's constants query returns, for when that fails.
export async function fetchOpenDotaItems() {
  const ids = await itemConstants()
  return Object.entries(ids).map(([id, shortName]) => ({
    id: Number(id),
    shortName,
    displayName: shortName.replace(/^recipe_/, 'Recipe: ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    stat: { isRecipe: shortName.startsWith('recipe_') },
  }))
}

// OpenDota's rune keys, as Stratz's RuneEnums.
const RUNES = ['DOUBLE_DAMAGE', 'HASTE', 'ILLUSION', 'INVISIBILITY', 'REGEN', 'BOUNTY', 'ARCANE', 'WATER', 'WISDOM', 'SHIELD']
// lane_role → Stratz's lane names.
const LANE_ROLES = { 1: 'SAFE_LANE', 2: 'MID_LANE', 3: 'OFF_LANE', 4: 'JUNGLE' }
// Total XP needed for each level (index 0 = level 1), to rebuild level-up times from the XP timeline.
const XP_TO_LEVEL = [0, 240, 640, 1160, 1760, 2440, 3200, 4000, 4900, 5900, 7000, 8200, 9500, 10900, 12400, 14000,
  15700, 17500, 19400, 21400, 23600, 26000, 28600, 31400, 34400, 38400, 43400, 49400, 56400, 63900]

// OpenDota timelines are running totals per minute; Stratz's are the amount gained each minute.
const perMinute = totals => (totals ?? []).slice(1).map((v, i) => v - totals[i])

// The second each level was reached, interpolated within the minute from cumulative XP (level 1 at 0).
function levelTimes(xpTotals) {
  const times = [0]
  for (let lvl = 1; lvl < XP_TO_LEVEL.length; lvl++) {
    const need = XP_TO_LEVEL[lvl]
    const m = xpTotals.findIndex(xp => xp >= need)
    if (m < 0) break
    const prev = m > 0 ? xpTotals[m - 1] : 0
    const frac = m > 0 && xpTotals[m] > prev ? (need - prev) / (xpTotals[m] - prev) : 0
    times.push(Math.round((m - 1 + frac) * 60))
  }
  return times
}

function convertPlayer(p, heroes, itemIdByName, heroIdByName, parsed) {
  const heroId = name => heroIdByName.get(name?.replace('npc_dota_hero_', '')) ?? null
  const position = p.position_est ? `POSITION_${p.position_est}` : null
  return {
    steamAccountId: p.account_id ?? null,
    playerSlot: p.player_slot,
    partyId: p.party_size > 1 ? p.party_id : null,
    isRadiant: p.player_slot < 128,
    heroId: p.hero_id,
    item0Id: p.item_0, item1Id: p.item_1, item2Id: p.item_2, item3Id: p.item_3, item4Id: p.item_4, item5Id: p.item_5,
    backpack0Id: p.backpack_0, backpack1Id: p.backpack_1, backpack2Id: p.backpack_2,
    neutral0Id: p.item_neutral,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    numLastHits: p.last_hits,
    numDenies: p.denies,
    goldPerMinute: p.gold_per_min,
    experiencePerMinute: p.xp_per_min,
    networth: p.net_worth,
    level: p.level,
    heroDamage: p.hero_damage,
    // lane_role over is_roaming: OpenDota flags laning supports as roaming where Stratz keeps them in lane.
    lane: LANE_ROLES[p.lane_role] ?? (p.is_roaming ? 'ROAMING' : null),
    position,
    stats: parsed ? {
      lastHitsPerMinute: perMinute(p.lh_t),
      deniesPerMinute: perMinute(p.dn_t),
      goldPerMinute: perMinute(p.gold_t),
      experiencePerMinute: perMinute(p.xp_t),
      networthPerMinute: p.networth_t ?? p.gold_t,
      heroDamagePerMinute: perMinute(p.hero_damage_t),
      // Not in OpenDota's data: left out rather than shown as zero.
      towerDamagePerMinute: null,
      assistEvents: null,
      level: levelTimes(p.xp_t ?? []),
      killEvents: (p.kills_log ?? []).map(k => ({ time: k.time, target: heroId(k.key), isSolo: false, isGank: false })),
      deathEvents: (p.deaths_log ?? []).map(d => ({ time: d.time, attacker: heroId(d.key), goldFed: d.gold_lost ?? 0, timeDead: d.time_dead })),
      itemPurchases: (p.purchase_log ?? [])
        .map(e => ({ time: e.time, itemId: itemIdByName.get(e.key) }))
        .filter(e => e.itemId != null),
      runes: (p.runes_log ?? []).map(r => ({ time: r.time, rune: RUNES[Number(r.key)] ?? null, action: 'PICKUP' })),
    } : null,
    hero: heroes[p.hero_id] ?? null,
    steamAccount: {
      id: p.account_id ?? null,
      name: p.personaname ?? null,
      avatar: null,
      isAnonymous: p.account_id == null,
      seasonRank: p.rank_tier ?? null,
      seasonLeaderboardRank: null,
    },
  }
}

// Kills per minute for one side, the shape of Stratz's radiantKills / direKills.
function killsPerMinute(players, duration) {
  const counts = Array(Math.floor(duration / 60) + 1).fill(0)
  for (const p of players) {
    for (const k of p.kills_log ?? []) counts[Math.min(counts.length - 1, Math.max(0, Math.floor(k.time / 60)))]++
  }
  return counts
}

// A match in the shape loadMatchPlayers returns from Stratz, plus `source: 'opendota'` and the Aegis
// pickups OpenDota lists directly ([{ time, playerSlot }]). Things only Stratz has (lane outcomes,
// win probability) are null.
async function convertMatch(raw) {
  const [heroes, itemIds] = await Promise.all([heroConstants(), itemConstants()])
  const itemIdByName = new Map(Object.entries(itemIds).map(([id, name]) => [name, Number(id)]))
  const heroIdByName = new Map(Object.entries(heroes).map(([id, h]) => [h.shortName, Number(id)]))
  const parsed = !!raw.od_data?.has_parsed && raw.players.every(p => p.gold_t?.length)
  const radiant = raw.players.filter(p => p.player_slot < 128)
  const dire = raw.players.filter(p => p.player_slot >= 128)
  const objectives = raw.objectives ?? []
  return {
    source: 'opendota',
    id: raw.match_id,
    parsedDateTime: parsed ? raw.start_time + raw.duration : null,
    startDateTime: raw.start_time,
    durationSeconds: raw.duration,
    didRadiantWin: raw.radiant_win,
    topLaneOutcome: null,
    midLaneOutcome: null,
    bottomLaneOutcome: null,
    firstBloodTime: raw.first_blood_time ?? null,
    // OpenDota tracks the gold lead rather than net worth; close enough to stand in for it.
    radiantNetworthLeads: raw.radiant_gold_adv ?? null,
    radiantExperienceLeads: raw.radiant_xp_adv ?? null,
    winRates: null,
    radiantKills: parsed ? killsPerMinute(radiant, raw.duration) : [raw.radiant_score ?? 0],
    direKills: parsed ? killsPerMinute(dire, raw.duration) : [raw.dire_score ?? 0],
    towerDeaths: objectives
      .filter(o => o.type === 'building_kill' && /tower/.test(o.key ?? ''))
      .map(o => ({ time: o.time, isRadiant: o.key.includes('goodguys') })),
    aegisPickups: objectives
      .filter(o => o.type === 'CHAT_MESSAGE_AEGIS' && o.player_slot != null)
      .map(o => ({ time: o.time, playerSlot: o.player_slot })),
    players: raw.players.map(p => convertPlayer(p, heroes, itemIdByName, heroIdByName, parsed)),
  }
}

// Parsed matches are stored like Stratz's; unparsed ones are fetched fresh so a parse shows up.
export async function fetchOpenDotaMatch(matchId) {
  const stored = await getStored('odmatch', matchId)
  if (stored !== undefined) return stored
  const match = await convertMatch(await odGet(`/matches/${matchId}`))
  if (match.parsedDateTime != null) putStored('odmatch', matchId, match)
  return match
}

// Asks OpenDota to fetch and parse the replay. True when it queued a job.
export async function requestOpenDotaParse(matchId) {
  const resp = await fetch(`${API}/request/${matchId}`, { method: 'POST' })
  if (!resp.ok) return false
  const body = await resp.json().catch(() => null)
  return !!body?.job
}

const RANKED_LOBBY = 7
const MATCH_FIELDS = ['hero_id', 'player_slot', 'radiant_win', 'kills', 'deaths', 'assists', 'duration', 'start_time']

// One player's profile and last 3 months of ranked games, in the shape of Stratz's player batch:
// { steamAccount, anyMatch, recentPeriod, periodComplete, matches, allMatches, source }. OpenDota returns
// the whole period in one call, so it's complete and "show more" pages through `allMatches` locally.
async function loadOpenDotaPlayer(accountId, heroes) {
  const project = MATCH_FIELDS.map(f => `project=${f}`).join('&')
  const [profile, games] = await Promise.all([
    odGet(`/players/${accountId}`),
    odGet(`/players/${accountId}/matches?date=90&lobby_type=${RANKED_LOBBY}&${project}`),
  ])
  const matches = games.map(g => ({
    id: g.match_id,
    didRadiantWin: g.radiant_win,
    durationSeconds: g.duration,
    startDateTime: g.start_time,
    players: [{
      isRadiant: g.player_slot < 128,
      heroId: g.hero_id,
      kills: g.kills,
      deaths: g.deaths,
      assists: g.assists,
      position: null,
      hero: heroes[g.hero_id] ?? null,
    }],
  }))
  return {
    source: 'opendota',
    steamAccount: {
      name: profile.profile?.personaname ?? null,
      avatar: profile.profile?.avatarfull ?? null,
      isAnonymous: !profile.profile,
      seasonRank: profile.rank_tier ?? null,
      seasonLeaderboardRank: profile.leaderboard_rank ?? null,
    },
    anyMatch: matches.length || profile.profile ? [{ id: matches[0]?.id ?? null }] : [],
    recentPeriod: matches,
    periodComplete: true,
    matches: matches.slice(0, 10),
    allMatches: matches,
  }
}

// { [accountId]: playerData | null }; a player OpenDota can't return is null rather than failing the rest.
export async function fetchOpenDotaPlayers(accountIds) {
  const heroes = await heroConstants()
  const entries = await Promise.all(accountIds.map(async id => {
    try {
      return [id, await loadOpenDotaPlayer(id, heroes)]
    } catch (err) {
      console.error(`[OpenDota] player ${id}:`, err.message)
      return [id, null]
    }
  }))
  return Object.fromEntries(entries)
}
