export const LANE_MINUTE = 10

export const POSITION_LABELS = {
  POSITION_1: 'Carry',
  POSITION_2: 'Mid',
  POSITION_3: 'Offlane',
  POSITION_4: 'Soft Support',
  POSITION_5: 'Hard Support',
}

const MAP_LANES = [
  { key: 'bottom', label: 'Bottom Lane', radiantRole: 'Safe lane', direRole: 'Off lane' },
  { key: 'mid', label: 'Mid Lane', radiantRole: 'Mid', direRole: 'Mid' },
  { key: 'top', label: 'Top Lane', radiantRole: 'Off lane', direRole: 'Safe lane' },
  { key: 'other', label: 'Jungle / Roaming' },
]

const OUTCOME_TEXT = {
  RADIANT_STOMP: { text: 'Radiant stomped the lane', side: 'radiant' },
  RADIANT_VICTORY: { text: 'Radiant won the lane', side: 'radiant' },
  DIRE_STOMP: { text: 'Dire stomped the lane', side: 'dire' },
  DIRE_VICTORY: { text: 'Dire won the lane', side: 'dire' },
  TIE: { text: 'Even lane', side: 'neutral' },
}

// Radiant's safe lane is bottom and Dire's is top; the off lanes are the reverse.
export function mapLane(lane, isRadiant) {
  if (lane === 'MID_LANE') return 'mid'
  if (lane === 'SAFE_LANE') return isRadiant ? 'bottom' : 'top'
  if (lane === 'OFF_LANE') return isRadiant ? 'top' : 'bottom'
  return null
}

export function positionNumber(p) {
  const m = /POSITION_(\d)/.exec(p.thisMatch?.position ?? '')
  return m ? Number(m[1]) : 9
}

export function formatTime(seconds) {
  if (seconds == null) return '—'
  const sign = seconds < 0 ? '-' : ''
  const s = Math.abs(seconds)
  return `${sign}${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function compact(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  return abs >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))
}

export function signed(n) {
  if (!n) return '0'
  return `${n > 0 ? '+' : '−'}${compact(Math.abs(n))}`
}

function cumulative(arr) {
  let total = 0
  return (arr ?? []).map(v => (total += v))
}

const sumFirst = (arr, minute) => (arr ?? []).slice(0, minute).reduce((a, b) => a + b, 0)

// Stratz timelines: LH, denies, damage, gold and XP are amounts gained each minute;
// net worth is a running total starting at minute 0; level lists the second each level was reached.
export function statsAt(thisMatch, minute = LANE_MINUTE) {
  const s = thisMatch?.stats
  if (!s?.networthPerMinute?.length) return null
  const cutoff = minute * 60
  const eventsBy = events => (events ?? []).filter(e => e.time <= cutoff).length
  return {
    kills: eventsBy(s.killEvents),
    deaths: eventsBy(s.deathEvents),
    assists: eventsBy(s.assistEvents),
    lastHits: sumFirst(s.lastHitsPerMinute, minute),
    denies: sumFirst(s.deniesPerMinute, minute),
    gpm: Math.round(sumFirst(s.goldPerMinute, minute) / minute),
    xpm: Math.round(sumFirst(s.experiencePerMinute, minute) / minute),
    xp: sumFirst(s.experiencePerMinute, minute),
    networth: s.networthPerMinute[Math.min(minute, s.networthPerMinute.length - 1)],
    heroDamage: sumFirst(s.heroDamagePerMinute, minute),
    level: (s.level ?? []).filter(t => t <= cutoff).length,
  }
}

export function hasTimelines(players) {
  return players.length > 0 && players.every(p => p.thisMatch?.stats?.networthPerMinute?.length)
}

export function groupByLane(players) {
  if (!players.length || !players.every(p => p.thisMatch?.lane)) {
    return [{
      key: 'all',
      label: 'Players',
      radiant: players.filter(p => p.isRadiant),
      dire: players.filter(p => !p.isRadiant),
    }]
  }
  const groups = []
  for (const lane of MAP_LANES) {
    const inLane = players.filter(p => (mapLane(p.thisMatch.lane, p.isRadiant) ?? 'other') === lane.key)
    if (!inLane.length) continue
    const side = isRadiant => inLane
      .filter(p => p.isRadiant === isRadiant)
      .sort((a, b) => positionNumber(a) - positionNumber(b))
    groups.push({ ...lane, radiant: side(true), dire: side(false) })
  }
  return groups
}

export function laneOutcomeText(outcome) {
  return OUTCOME_TEXT[outcome] ?? null
}

// Per-minute Radiant-minus-Dire leads for the players in one lane.
export function laneLeads(group) {
  const all = [...group.radiant, ...group.dire]
  if (!group.radiant.length || !group.dire.length || !hasTimelines(all)) return null
  const minutes = Math.min(...all.map(p => p.thisMatch.stats.networthPerMinute.length))
  const sideTotal = (players, pick) => {
    const series = players.map(p => pick(p.thisMatch.stats))
    return Array.from({ length: minutes }, (_, i) => series.reduce((sum, s) => sum + (s[i] ?? 0), 0))
  }
  const lead = pick => {
    const r = sideTotal(group.radiant, pick)
    const d = sideTotal(group.dire, pick)
    return r.map((v, i) => v - d[i])
  }
  // Gained-per-minute series start at minute 1, so shift them to line up with net worth's minute 0.
  const shifted = arr => [0, ...cumulative(arr)]
  return {
    networth: lead(s => s.networthPerMinute),
    experience: lead(s => shifted(s.experiencePerMinute)),
    lastHits: lead(s => shifted(s.lastHitsPerMinute)),
  }
}

function heroName(p) {
  return p.thisMatch?.hero?.displayName ?? 'Unknown hero'
}

function sideName(isRadiant) {
  return isRadiant ? 'Radiant' : 'Dire'
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function compareRow(key, label, r, d, { lowerIsBetter = false, format = compact, rSub, dSub } = {}) {
  let better = null
  if (r !== d) better = (r > d) !== lowerIsBetter ? 'radiant' : 'dire'
  return { key, label, r, d, rText: format(r), dText: format(d), better, lowerIsBetter, rSub, dSub }
}

function deathSummary(players, enemies, isRadiant, byHeroId, cutoff) {
  const enemyLaners = new Set(enemies.map(p => p.heroId))
  const deaths = players.flatMap(p => (p.thisMatch.stats.deathEvents ?? []).filter(d => d.time <= cutoff))
  const rotators = new Map()
  for (const d of deaths) {
    if (enemyLaners.has(d.attacker)) continue
    const killer = byHeroId.get(d.attacker)
    if (killer && killer.isRadiant !== isRadiant) {
      rotators.set(heroName(killer), (rotators.get(heroName(killer)) ?? 0) + 1)
    }
  }
  return {
    total: deaths.length,
    rotators: [...rotators].map(([name, count]) => ({ name, count })),
    goldFed: deaths.reduce((sum, d) => sum + (d.goldFed ?? 0), 0),
  }
}

// The single factor that most explains the result, preferring ones that favour the lane winner.
function laneHeadline(outcome, rows) {
  const row = key => rows.find(r => r.key === key)
  const scales = { deaths: 2, lastHits: 15, networth: 1000, xp: 1000 }
  const winner = outcome?.side === 'radiant' || outcome?.side === 'dire' ? outcome.side : null
  const candidates = Object.entries(scales)
    .map(([key, scale]) => ({ row: row(key), score: Math.abs(row(key).r - row(key).d) / scale }))
    .filter(c => c.row.better)
    .sort((a, b) => b.score - a.score)
  const top = candidates.find(c => !winner || c.row.better === winner) ?? candidates[0]
  const lead = outcome?.text ?? 'This lane'

  if (!top || top.score < 0.6) return `${lead}: neither side built a clear edge by ${LANE_MINUTE}:00.`
  const { row: r } = top
  const winSide = sideName(r.better === 'radiant')
  const loseSide = sideName(r.better !== 'radiant')
  const hi = Math.max(r.r, r.d)
  const lo = Math.min(r.r, r.d)
  const phrases = {
    deaths: `${loseSide} died ${plural(hi, 'time')} to ${winSide}'s ${lo}`,
    lastHits: `${hi} last hits to ${loseSide}'s ${lo}`,
    networth: `${compact(hi - lo)} more net worth than ${loseSide} at ${LANE_MINUTE}:00`,
    xp: `${compact(hi - lo)} more XP than ${loseSide} at ${LANE_MINUTE}:00`,
  }
  return `${lead}: ${phrases[r.key]}.`
}

// Side-by-side numbers for one lane at the end of the laning stage.
export function laneBreakdown(group, allPlayers, outcome, minute = LANE_MINUTE) {
  const all = [...group.radiant, ...group.dire]
  if (!group.radiant.length || !group.dire.length || !hasTimelines(all)) return null

  const cutoff = minute * 60
  const byHeroId = new Map(allPlayers.map(p => [p.heroId, p]))
  const at = new Map(all.map(p => [p, statsAt(p.thisMatch, minute)]))
  const total = (players, key) => players.reduce((sum, p) => sum + (at.get(p)?.[key] ?? 0), 0)
  const levels = players => `Lvl ${players.map(p => at.get(p)?.level ?? '—').join(' & ')}`
  const deathsR = deathSummary(group.radiant, group.dire, true, byHeroId, cutoff)
  const deathsD = deathSummary(group.dire, group.radiant, false, byHeroId, cutoff)

  const rows = [
    compareRow('networth', 'Net worth', total(group.radiant, 'networth'), total(group.dire, 'networth')),
    compareRow('lastHits', 'Last hits', total(group.radiant, 'lastHits'), total(group.dire, 'lastHits'), { format: String }),
    compareRow('denies', 'Denies', total(group.radiant, 'denies'), total(group.dire, 'denies'), { format: String }),
    compareRow('xp', 'Experience', total(group.radiant, 'xp'), total(group.dire, 'xp'), {
      rSub: levels(group.radiant),
      dSub: levels(group.dire),
    }),
    compareRow('deaths', 'Deaths', deathsR.total, deathsD.total, { lowerIsBetter: true, format: String }),
    compareRow('goldFed', 'Gold given away', deathsR.goldFed, deathsD.goldFed, { lowerIsBetter: true }),
  ]

  const rotations = [
    ...deathsR.rotators.length ? [{ victims: 'Radiant', killers: deathsR.rotators }] : [],
    ...deathsD.rotators.length ? [{ victims: 'Dire', killers: deathsD.rotators }] : [],
  ]

  let core = null
  const coreR = group.radiant[0]
  const coreD = group.dire[0]
  if (group.key !== 'mid' && coreR && coreD) {
    const r = at.get(coreR)
    const d = at.get(coreD)
    core = {
      radiant: heroName(coreR),
      dire: heroName(coreD),
      rows: [
        compareRow('lastHits', 'Last hits', r.lastHits, d.lastHits, { format: String }),
        compareRow('networth', 'Net worth', r.networth, d.networth),
        compareRow('level', 'Level', r.level, d.level, { format: String }),
      ],
    }
  }

  return { headline: laneHeadline(outcome, rows), rows, rotations, core }
}

function leadSideText(lead) {
  if (!lead) return 'even'
  return `${sideName(lead > 0)} +${compact(Math.abs(lead))}`
}

export function gameFacts(match, view, minute = LANE_MINUTE) {
  if (!match) return []
  const facts = []
  const nw = match.radiantNetworthLeads ?? []
  const xp = match.radiantExperienceLeads ?? []
  const killsR = match.radiantKills ?? []
  const killsD = match.direKills ?? []

  if (view === 'laning') {
    if (nw.length > minute) facts.push({ label: `Net worth at ${minute}:00`, value: leadSideText(nw[minute]) })
    if (xp.length > minute) facts.push({ label: `XP at ${minute}:00`, value: leadSideText(xp[minute]) })
    if (killsR.length) {
      facts.push({ label: `Kills by ${minute}:00`, value: `${sumFirst(killsR, minute)} – ${sumFirst(killsD, minute)}` })
    }
    if (match.firstBloodTime != null) facts.push({ label: 'First blood', value: formatTime(match.firstBloodTime) })
    const outcomes = Object.values(match.laneOutcomes ?? {}).filter(Boolean)
    if (outcomes.length) {
      const won = side => outcomes.filter(o => o.startsWith(side)).length
      facts.push({ label: 'Lanes won', value: `Radiant ${won('RADIANT')} · Dire ${won('DIRE')} · Even ${outcomes.filter(o => o === 'TIE').length}` })
    }
    return facts
  }

  if (match.didRadiantWin != null) {
    facts.push({ label: 'Result', value: `${sideName(match.didRadiantWin)} victory in ${formatTime(match.durationSeconds)}` })
  }
  if (killsR.length) {
    facts.push({ label: 'Final kills', value: `${killsR.reduce((a, b) => a + b, 0)} – ${killsD.reduce((a, b) => a + b, 0)}` })
  }
  if (nw.length) {
    const maxR = Math.max(0, ...nw)
    const maxD = Math.min(0, ...nw)
    if (maxR > 0) facts.push({ label: 'Biggest Radiant lead', value: `+${compact(maxR)} at ${nw.indexOf(maxR)}:00` })
    if (maxD < 0) facts.push({ label: 'Biggest Dire lead', value: `+${compact(-maxD)} at ${nw.indexOf(maxD)}:00` })
    let swaps = 0
    let prev = 0
    for (const v of nw) {
      const sign = Math.sign(v)
      if (sign && prev && sign !== prev) swaps++
      if (sign) prev = sign
    }
    facts.push({ label: 'Lead changes', value: String(swaps) })
  }
  const firstBuilding = [...(match.towerDeaths ?? [])].sort((a, b) => a.time - b.time)[0]
  if (firstBuilding) {
    facts.push({ label: 'First building', value: `${sideName(firstBuilding.isRadiant)} lost one at ${formatTime(firstBuilding.time)}` })
  }
  return facts
}
