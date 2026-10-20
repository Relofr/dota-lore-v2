<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchPlayersData,
  fetchMatchPlayers,
  fetchMatchPlayback,
  fetchPlayerMatches,
  fetchRankedPeriodPage,
  fetchItems,
  forgetMatch,
  requestMatchParse,
  PERIOD_PAGE_SIZE,
} from '@/services/stratzApi.js'
import {
  LANE_MINUTE,
  POSITION_LABELS,
  compact,
  formatTime,
  statsAt,
  groupByLane,
  laneLeads,
  leadSeries,
  fineSeries,
  laneBreakdown,
  laneOutcomeText,
  gameFacts,
} from '@/utils/matchAnalysis.js'
import StratzIcon from '@/components/StratzIcon.vue'
import RankMedal from '@/components/RankMedal.vue'
import LeadChart from '@/components/scout/LeadChart.vue'
import TeamChart from '@/components/scout/TeamChart.vue'
import ItemRow from '@/components/scout/ItemRow.vue'
import LaneBreakdown from '@/components/scout/LaneBreakdown.vue'
import HeroIcon from '@/components/scout/HeroIcon.vue'
import RoleIcon from '@/components/scout/RoleIcon.vue'
import LaneCard from '@/components/scout/LaneCard.vue'
import LaneOutcome from '@/components/scout/LaneOutcome.vue'
import MatchupCard from '@/components/scout/MatchupCard.vue'
import TeamLineup from '@/components/scout/TeamLineup.vue'

const OPENDOTA_ICON = 'https://www.opendota.com/assets/images/icons/icon-512x512.png'
const DOTABUFF_ICON = 'https://www.dotabuff.com/assets/favicon-retina-377ae687bcef452311a9c4303e2efcb1a3e9dceeb924084856e960256862b843.png'
const route = useRoute()
const router = useRouter()
const matchIdInput = ref('')
const loading = ref(false)
const error = ref(null)
const match = ref(null)
const view = ref('laning')
// The stat row under the pointer, as `lane:pair:label`, so the facing hero's card lights the same row.
const hoveredStat = ref(null)
// The summary chart's measures, overlaid when more than one is picked.
const teamMetrics = ref(['networth'])
const laneMetric = ref({})
const itemMap = ref(new Map())
const historyOpen = ref({})
const playerData = ref({})
const dataLoading = ref({})
const periodLoading = ref({})
const moreLoading = ref({})
const noMoreMatches = ref({})

const itemsLoading = ref(false)

// Item names and icons are only needed once a match is showing; fetchItems caches them for a day.
async function loadItems() {
  if (itemMap.value.size || itemsLoading.value) return
  itemsLoading.value = true
  try {
    itemMap.value = await fetchItems()
  } catch (err) {
    console.error('[Scout] items:', err.message)
  } finally {
    itemsLoading.value = false
  }
}

const players = computed(() => match.value?.players ?? [])

// Per-second series (playerSlot → series) for the laning view; until they arrive, charts use per-minute data.
const playback = ref(null)
const fine = computed(() => (view.value === 'laning' ? playback.value : null))

async function loadPlayback(matchId) {
  try {
    const series = fineSeries(await fetchMatchPlayback(matchId))
    if (match.value?.matchId === matchId && series.size) playback.value = series
  } catch (err) {
    console.error('[Scout] playback:', err.message)
  }
}

const laneGroups = computed(() => groupByLane(players.value).map(group => {
  const outcome = laneOutcomeText(match.value?.laneOutcomes?.[group.key])
  return {
    ...group,
    outcome,
    leads: laneLeads(group, fine.value),
    breakdown: laneBreakdown(group, players.value, outcome),
    rows: pairUp(group.radiant, group.dire),
  }
}))

const facts = computed(() => gameFacts(match.value, view.value))

// Each party gets its own bracket colour so neighbouring parties stay distinct.
const PARTY_COLORS = ['#34bfff', '#e8c547', '#d65db1', '#4bb45f']

// Party members are moved next to each other (in order of their first player) so a bracket above the
// cards can span them; players who queued solo keep their place and get no bracket.
function rosterTeam(key, label, won, list, colorOffset = 0) {
  const sizes = new Map()
  for (const p of list) {
    const id = p.thisMatch?.partyId
    if (id != null) sizes.set(id, (sizes.get(id) ?? 0) + 1)
  }
  const partyOf = p => (sizes.get(p.thisMatch?.partyId) > 1 ? p.thisMatch.partyId : null)
  const ordered = []
  for (const p of list) {
    if (ordered.includes(p)) continue
    const id = partyOf(p)
    ordered.push(...(id == null ? [p] : list.filter(q => partyOf(q) === id)))
  }
  const parties = []
  ordered.forEach((p, i) => {
    const id = partyOf(p)
    if (id == null || parties.some(pt => pt.key === id)) return
    const color = PARTY_COLORS[(colorOffset + parties.length) % PARTY_COLORS.length]
    parties.push({ key: id, start: i + 1, size: sizes.get(id), color })
  })
  return { key, label, won, players: ordered, parties }
}

// Dire's party colours continue on from Radiant's, so no two brackets in the match share a colour.
const rosterTeams = computed(() => {
  const won = match.value?.didRadiantWin
  const radiant = rosterTeam('radiant', 'Radiant', won === true, players.value.filter(p => p.isRadiant))
  const dire = rosterTeam('dire', 'Dire', won === false, players.value.filter(p => !p.isRadiant), radiant.parties.length)
  return [radiant, dire]
})

// The three real lanes get a matchup card in the sidebar; roamers only appear in the panels.
const laneCards = computed(() => laneGroups.value.filter(g => g.key !== 'other'))

function scrollToSection(id) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

function scrollToLane(key) {
  scrollToSection(`lane-${key}`)
}

function laneKeyOf(p) {
  return laneGroups.value.find(g => g.radiant.includes(p) || g.dire.includes(p))?.key ?? null
}

// Which section is in view, so the sidebar can highlight it: the first one whose top part is on screen.
const activeSection = ref('overview')
let sectionObserver = null
const visibleSections = new Set()

function watchSections() {
  sectionObserver?.disconnect()
  visibleSections.clear()
  const sections = [...document.querySelectorAll('[data-section]')]
  if (!sections.length || typeof IntersectionObserver === 'undefined') return
  // The band is just under the sticky app header, so a section counts once its top reaches there.
  sectionObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) visibleSections.add(e.target.id)
      else visibleSections.delete(e.target.id)
    }
    const first = sections.find(el => visibleSections.has(el.id))
    if (first) activeSection.value = first.id
  }, { rootMargin: '-80px 0px -55% 0px' })
  for (const el of sections) sectionObserver.observe(el)
}

watch(
  () => [match.value?.matchId, match.value?.isParsed, laneGroups.value.length],
  async () => {
    activeSection.value = 'overview'
    await nextTick()
    watchSections()
  },
)
onBeforeUnmount(() => sectionObserver?.disconnect())



// Line colours for when measures are overlaid: a validated set (all pairs, dark surface #1a1f2b) that
// stays clear of the Radiant green and Dire red. Win probability is dashed in a neutral, as it isn't a lead.
const TEAM_METRICS = [
  { key: 'heroDamage', tab: 'Hero Damage', label: 'Team Hero Damage Lead', color: '#d55181' },
  { key: 'winProbability', tab: 'Win Probability', label: 'Win Probability', color: '#c3c8d2', kind: 'probability' },
  { key: 'networth', tab: 'Net Worth', label: 'Team Net Worth Lead', color: '#c98500' },
  { key: 'experience', tab: 'Experience', label: 'Team Experience Lead', color: '#3987e5' },
]

const teamLeads = computed(() =>
  leadSeries(players.value.filter(p => p.isRadiant), players.value.filter(p => !p.isRadiant), fine.value))

// Stratz has team-level leads for net worth and XP only; damage is summed from the players.
function teamMetricSeries(metric) {
  const m = match.value
  if (metric === 'winProbability') {
    return m.winRates?.length ? { values: windowed(m.winRates), step: 60 } : null
  }
  if (fine.value || metric === 'heroDamage') {
    const leads = teamLeads.value
    if (leads) return { values: windowed(leads[metric], leads.step), step: leads.step }
    if (metric === 'heroDamage') return null
  }
  const source = metric === 'networth' ? m.radiantNetworthLeads : m.radiantExperienceLeads
  return source?.length ? { values: windowed(source), step: 60 } : null
}

// Every measure this match has data for, so a chip only shows when it can draw something.
const teamAvailable = computed(() => {
  if (!match.value) return []
  return TEAM_METRICS
    .map(tm => ({ ...tm, kind: tm.kind ?? 'lead', ...teamMetricSeries(tm.key) }))
    .filter(tm => tm.values?.length)
})

const teamSeries = computed(() => {
  const picked = teamAvailable.value.filter(tm => teamMetrics.value.includes(tm.key))
  // Falls back to the first measure if nothing picked has data (e.g. no win probability for this match).
  return picked.length ? picked : teamAvailable.value.slice(0, 1)
})

// Toggles a measure on or off, but never the last one: the chart always shows something.
function toggleTeamMetric(key) {
  const shown = teamSeries.value.map(s => s.key)
  if (shown.includes(key)) {
    if (shown.length > 1) teamMetrics.value = shown.filter(k => k !== key)
  } else {
    teamMetrics.value = [...shown, key]
  }
}

const teamKills = computed(() => {
  const sum = arr => (arr ?? []).reduce((a, b) => a + b, 0)
  return { radiant: sum(match.value?.radiantKills), dire: sum(match.value?.direKills) }
})

function pairUp(radiant, dire) {
  const rows = []
  for (let i = 0; i < Math.max(radiant.length, dire.length); i++) {
    rows.push({ radiant: radiant[i] ?? null, dire: dire[i] ?? null })
  }
  return rows
}

function windowed(values, step = 60) {
  return view.value === 'laning' ? values.slice(0, (LANE_MINUTE * 60) / step + 1) : values
}

const LANE_METRICS = [
  { key: 'networth', tab: 'Net Worth' },
  { key: 'experience', tab: 'Experience' },
  { key: 'heroDamage', tab: 'Hero Damage' },
]

function laneChart(group) {
  const leads = group.leads
  const metric = laneMetric.value[group.key] ?? 'networth'
  const heroes = leads.heroes.map(h => ({
    key: h.player.thisMatch.playerSlot ?? h.player.heroId,
    hero: h.player.thisMatch.hero,
    isRadiant: h.player.isRadiant,
    values: windowed(h[metric], leads.step),
  }))
  if (metric === 'experience') {
    return {
      label: 'Lane Experience Lead',
      values: windowed(leads.experience, leads.step),
      extras: [
        { label: 'Net worth lead', values: windowed(leads.networth, leads.step) },
        { label: 'Last hit lead', values: windowed(leads.lastHits, leads.step) },
      ],
      heroes,
    }
  }
  if (metric === 'heroDamage') {
    return {
      label: 'Lane Hero Damage Lead',
      values: windowed(leads.heroDamage, leads.step),
      extras: [],
      heroes,
    }
  }
  return {
    label: 'Lane Net Worth Lead',
    values: windowed(leads.networth, leads.step),
    extras: [
      { label: 'XP lead', values: windowed(leads.experience, leads.step) },
      { label: 'Last hit lead', values: windowed(leads.lastHits, leads.step) },
    ],
    heroes,
  }
}

// This player's stats as rows, @10 and end of game side by side, for the vertical table on each card.
function matchStatRows(p) {
  const m = p.thisMatch
  const at = statsAt(m)
  const pair = (a, b) => (a == null || b == null ? '—' : `${a} / ${b}`)
  return [
    { label: 'Level', at: at?.level, total: m.level },
    { label: 'K / D / A', at: at && `${at.kills} / ${at.deaths} / ${at.assists}`, total: `${m.kills} / ${m.deaths} / ${m.assists}` },
    { label: 'LH / DN', at: at && pair(at.lastHits, at.denies), total: pair(m.numLastHits, m.numDenies) },
    { label: 'GPM / XPM', at: at && pair(at.gpm, at.xpm), total: pair(m.goldPerMinute, m.experiencePerMinute) },
    { label: 'Net worth', at: at && compact(at.networth), total: m.networth != null ? compact(m.networth) : null },
    { label: 'Hero damage', at: at && compact(at.heroDamage), total: m.heroDamage != null ? compact(m.heroDamage) : null },
  ]
}

function positionText(p) {
  const pos = p.thisMatch?.position
  const n = /POSITION_(\d)/.exec(pos ?? '')?.[1]
  return n ? `Pos ${n} · ${POSITION_LABELS[pos]}` : null
}

function laneItems(p) {
  const purchases = p.thisMatch?.stats?.itemPurchases ?? []
  const grouped = new Map()
  for (const buy of purchases) {
    if (buy.time > LANE_MINUTE * 60) continue
    if (itemMap.value.get(buy.itemId)?.stat?.isRecipe) continue
    const seen = grouped.get(buy.itemId)
    if (seen) seen.count++
    else grouped.set(buy.itemId, { id: buy.itemId, time: buy.time, count: 1 })
  }
  return [...grouped.values()]
}

function finalItems(p) {
  const tm = p.thisMatch ?? {}
  const slot = (id, kind) => (id ? [{ id, kind }] : [])
  return [
    ...[0, 1, 2, 3, 4, 5].flatMap(i => slot(tm[`item${i}Id`], 'slot')),
    ...slot(tm.neutral0Id, 'neutral'),
    ...[0, 1, 2].flatMap(i => slot(tm[`backpack${i}Id`], 'backpack')),
  ]
}

function playerItems(p) {
  return view.value === 'laning' ? laneItems(p) : finalItems(p)
}

function toggleHistory(p) {
  const key = cardKey(p)
  historyOpen.value[key] = !historyOpen.value[key]
  if (historyOpen.value[key] && p.accountId) loadRestOfPeriod(p.accountId)
}

// Whether the 3-month record covers every game, or just the first page from the batched query.
function periodComplete(accountId) {
  const data = playerData.value[accountId]
  return !data?.recentPeriod || data.periodComplete || data.recentPeriod.length < PERIOD_PAGE_SIZE
}

function cardKey(p) {
  return p.thisMatch?.playerSlot ?? p.heroId
}

function topHeroes(accountId) {
  const games = playerData.value[accountId]?.recentPeriod
  if (!games?.length) return []
  const byHero = new Map()
  for (const m of games) {
    const p = m.players?.[0]
    if (!p?.heroId) continue
    const h = byHero.get(p.heroId) ?? { heroId: p.heroId, hero: p.hero, matchCount: 0, winCount: 0 }
    h.matchCount++
    if (p.isRadiant === m.didRadiantWin) h.winCount++
    byHero.set(p.heroId, h)
  }
  return [...byHero.values()]
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 5)
}

function playerRoles(accountId) {
  const data = playerData.value[accountId]
  if (!data?.matches?.length) return []
  const counts = {}
  for (const m of data.matches.slice(0, 10)) {
    const pos = m.players?.[0]?.position
    if (pos) counts[pos] = (counts[pos] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([pos]) => pos)
}

function isPrivate(p) {
  if (!p.accountId) return true
  const data = playerData.value[p.accountId]
  return data?.steamAccount?.isAnonymous === true || !data?.anyMatch?.length
}

function overallRecord(p) {
  const games = playerData.value[p.accountId]?.recentPeriod
  if (!games?.length) return null
  let wins = 0
  for (const m of games) {
    if (m.players?.[0] && m.players[0].isRadiant === m.didRadiantWin) wins++
  }
  return {
    rate: Math.round((wins / games.length) * 100),
    wins,
    losses: games.length - wins,
  }
}

function playerAvatar(p) {
  return playerData.value[p.accountId]?.steamAccount?.avatar || p.avatar || null
}

function playerName(p) {
  if (!p.accountId) return 'Anonymous'
  return playerData.value[p.accountId]?.steamAccount?.name || p.name
}

function recentMatches(accountId) {
  return playerData.value[accountId]?.matches ?? []
}

function winRate(h) {
  return Math.round((h.winCount / h.matchCount) * 100)
}

function matchWon(m) {
  const p = m.players?.[0]
  if (!p) return false
  return p.isRadiant === m.didRadiantWin
}

function timeAgo(unix) {
  if (!unix) return ''
  const s = Date.now() / 1000 - unix
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// The first page comes with the batched query. Players at the page cap get the rest fetched one page at a
// time, but only once their history is opened.
async function loadRestOfPeriod(accountId) {
  const data = playerData.value[accountId]
  if (periodComplete(accountId) || periodLoading.value[accountId]) return
  periodLoading.value[accountId] = true
  try {
    let page
    do {
      page = await fetchRankedPeriodPage(accountId, data.recentPeriod.length)
      data.recentPeriod = [...data.recentPeriod, ...page]
    } while (page.length === PERIOD_PAGE_SIZE)
    // Stored on the cached object, so reopening this player later doesn't page again.
    data.periodComplete = true
  } catch (err) {
    console.error(`[Scout] 3-month matches ${accountId}:`, err.message)
  } finally {
    periodLoading.value[accountId] = false
  }
}

async function loadAllPlayerData() {
  const ids = match.value.players.map(p => p.accountId).filter(Boolean)
  if (!ids.length) return
  for (const id of ids) dataLoading.value[id] = true
  try {
    playerData.value = await fetchPlayersData(ids)
  } catch (err) {
    console.error('[Scout] player data:', err.message)
    error.value = `Couldn't load player stats: ${err.message}`
  } finally {
    for (const id of ids) dataLoading.value[id] = false
  }
}

async function showMoreMatches(accountId) {
  const data = playerData.value[accountId]
  if (!data || moreLoading.value[accountId]) return
  moreLoading.value[accountId] = true
  try {
    const more = await fetchPlayerMatches(accountId, data.matches.length)
    data.matches = [...data.matches, ...more]
    if (more.length < 10) noMoreMatches.value[accountId] = true
  } catch (err) {
    console.error(`[Scout] more matches ${accountId}:`, err.message)
  } finally {
    moreLoading.value[accountId] = false
  }
}

// Stratz fills in parsedDateTime once the replay is processed; matches saved before that field was
// fetched only exist in storage if they were parsed, so their per-minute stats stand in for it.
function isParsedMatch(data) {
  return data?.parsedDateTime != null || (!!data?.players?.length && data.players.every(p => p.stats?.networthPerMinute?.length))
}

// 'idle' | 'sending' | 'sent' | 'refused' | 'error', for the not-parsed banner's request button.
const parseState = ref('idle')
const parseError = ref('')
const parseChecking = ref(false)
const stillUnparsed = ref(false)

async function requestParse() {
  const id = match.value?.matchId
  if (!id || parseState.value === 'sending') return
  parseState.value = 'sending'
  try {
    parseState.value = (await requestMatchParse(id)) ? 'sent' : 'refused'
  } catch (err) {
    parseError.value = err.message
    parseState.value = 'error'
  }
}

// One refetch per click; once parsed, the match reloads in full (and is saved for next time).
async function checkParsed() {
  const id = match.value?.matchId
  if (!id || parseChecking.value) return
  parseChecking.value = true
  stillUnparsed.value = false
  forgetMatch(id)
  try {
    const data = await fetchMatchPlayers(String(id))
    if (isParsedMatch(data)) await loadByMatchId(String(id))
    else stillUnparsed.value = true
  } catch (err) {
    parseError.value = err.message
    parseState.value = 'error'
  } finally {
    parseChecking.value = false
  }
}

function resetState() {
  parseState.value = 'idle'
  parseError.value = ''
  stillUnparsed.value = false
  match.value = null
  playerData.value = {}
  dataLoading.value = {}
  moreLoading.value = {}
  noMoreMatches.value = {}
  periodLoading.value = {}
  historyOpen.value = {}
  playback.value = null
  error.value = null
}

// The match ID lives in the URL (?match=…) so results can be shared; searching pushes a new URL and the
// watcher below does the loading, which also covers opening a shared link and the back button.
function searchMatch() {
  const mid = matchIdInput.value.trim()
  if (!mid) return
  if (route.query.match === mid) loadByMatchId(mid)
  else router.push({ query: { ...route.query, match: mid } })
}

watch(
  () => route.query.match,
  mid => {
    if (typeof mid !== 'string' || !mid) return
    matchIdInput.value = mid
    loadByMatchId(mid)
  },
  { immediate: true },
)

const MIN_LOADING_MS = 450

async function loadByMatchId(mid) {
  // The ID is interpolated into the GraphQL query, and shared links make it user-controlled.
  if (!/^\d+$/.test(mid)) {
    resetState()
    error.value = 'Match IDs are numbers only.'
    return
  }
  loading.value = true
  resetState()
  const started = Date.now()
  try {
    const data = await fetchMatchPlayers(mid)
    // Cached matches come back instantly; hold the loading state briefly so a reload visibly happens.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, MIN_LOADING_MS - (Date.now() - started))))
    if (!data?.players?.length) {
      error.value = `Match ${mid} not found.`
      return
    }
    match.value = {
      ...data,
      matchId: data.id,
      isParsed: isParsedMatch(data),
      laneOutcomes: {
        top: data.topLaneOutcome,
        mid: data.midLaneOutcome,
        bottom: data.bottomLaneOutcome,
      },
      players: data.players.map(p => ({
        accountId: p.steamAccountId,
        heroId: p.heroId,
        isRadiant: p.isRadiant,
        name: p.steamAccount?.name ?? `Player ${p.steamAccountId}`,
        avatar: p.steamAccount?.avatar ?? null,
        thisMatch: p,
      })),
    }
    // Unparsed matches only show the roster, whose names and avatars come with the match, so skip the rest.
    if (match.value.isParsed) {
      loadAllPlayerData()
      loadPlayback(data.id)
      loadItems()
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="scout-page">
    <header class="scout-header">
      <h1 class="scout-title">Match Scout</h1>
      <div class="search-row">
        <input
          v-model="matchIdInput"
          class="match-input"
          placeholder="Match ID"
          @keydown.enter="searchMatch"
        />
        <button class="load-btn" :disabled="loading" :aria-busy="loading" @click="searchMatch">
          <svg class="spin-icon" :class="{ spinning: loading }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <path d="M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ loading ? 'Loading…' : 'Load Match' }}
        </button>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </header>

    <!-- Placeholder shaped like the summary and a lane while the match loads. -->
    <div v-if="loading && !match" class="match-layout scout-skeleton" aria-busy="true" aria-label="Loading match">
      <aside class="match-nav">
        <span class="skel skel-chip" style="width: 100%" />
        <span v-for="i in 3" :key="i" class="skel" style="height: 88px" />
      </aside>
      <div class="match-content">
        <section class="panel summary">
          <div class="summary-top">
            <span class="skel" style="width: 5rem; height: 1.6rem" />
            <span class="skel" style="width: 6rem; height: 2.4rem" />
            <span class="skel" style="width: 5rem; height: 1.6rem; justify-self: end" />
          </div>
          <div class="lineups">
            <span class="skel" style="height: 90px" />
            <span class="skel" style="height: 90px" />
          </div>
          <div class="summary-body">
            <span class="skel" style="height: 220px" />
            <span class="skel" style="height: 220px" />
          </div>
        </section>
        <section class="panel lane-panel">
          <span class="skel" style="width: 8rem; height: 1.1rem; margin-bottom: 0.9rem" />
          <span class="skel" style="height: 170px; margin-bottom: 1rem" />
          <div class="skel-cards">
            <span v-for="j in 2" :key="j" class="skel" style="height: 150px" />
          </div>
        </section>
      </div>
    </div>

    <template v-if="match">
      <div v-if="!match.isParsed" class="parse-banner" role="status">
        <svg class="parse-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
        </svg>
        <div class="parse-text">
          <strong>This match hasn't been parsed yet</strong>
          <span>
            Stratz hasn't processed the replay
          </span>
          <span v-if="parseState === 'sent'" class="parse-note parse-ok">Parse requested. It can take a few minutes, so check again shortly.</span>
          <span v-else-if="parseState === 'refused'" class="parse-note parse-bad">Stratz couldn't queue this match. The replay may no longer be available.</span>
          <span v-else-if="parseState === 'error'" class="parse-note parse-bad">Something went wrong: {{ parseError }}</span>
          <span v-if="stillUnparsed && parseState !== 'error'" class="parse-note">Still not parsed.</span>
        </div>
        <div class="parse-actions">
          <button
            v-if="parseState !== 'sent'"
            type="button"
            class="parse-btn parse-primary"
            :disabled="parseState === 'sending'"
            @click="requestParse"
          >{{ parseState === 'sending' ? 'Requesting…' : 'Request Parse' }}</button>
          <button type="button" class="parse-btn" :disabled="parseChecking" :aria-busy="parseChecking" @click="checkParsed">
            <svg class="spin-icon" :class="{ spinning: parseChecking }" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              <path d="M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ parseChecking ? 'Checking…' : 'Check Again' }}
          </button>
        </div>
      </div>

      <!-- Unparsed: just who played what, until Stratz has the replay. -->
      <section v-if="!match.isParsed" class="panel roster">
        <h2 class="lane-title roster-title">Matchup</h2>
        <div class="roster-row">
          <template v-for="(team, ti) in rosterTeams" :key="team.key">
            <span v-if="ti" class="roster-vs" aria-hidden="true">vs</span>
            <TeamLineup :team="team" class="roster-team">
              <template #default="{ player }">
                <MatchupCard :player="player" />
              </template>
            </TeamLineup>
          </template>
        </div>
      </section>

      <div v-else class="match-layout">
        <!-- Sticky sidebar: the time range and each lane's hero matchup, which jumps to that lane. -->
        <aside class="match-nav" aria-label="Lanes">
          <div class="nav-toggle">
          <div class="chips view-toggle" role="tablist" aria-label="Time range">
            <button
              role="tab"
              :aria-selected="view === 'laning'"
              :class="{ active: view === 'laning' }"
              @click="view = 'laning'"
            >Laning · 0–{{ LANE_MINUTE }}</button>
            <button
              role="tab"
              :aria-selected="view === 'full'"
              :class="{ active: view === 'full' }"
              @click="view = 'full'"
            >Full Game</button>
          </div>
          </div>

          <div class="nav-lanes">
            <button
              type="button"
              class="nav-summary"
              :class="{ active: activeSection === 'overview' }"
              :aria-current="activeSection === 'overview' ? 'location' : null"
              title="Jump to the summary"
              @click="scrollToSection('overview')"
            >
              <span class="nav-summary-head">
                <span class="nav-summary-title">Summary</span>
                <span class="nav-summary-time">{{ formatTime(match.durationSeconds) }}</span>
              </span>
              <!-- The winning side's kills are gold, matching the Victory badges in the overview. -->
              <span class="nav-summary-score">
                <span class="side-radiant" :class="{ 'nav-winner': match.didRadiantWin === true }">{{ teamKills.radiant }}</span>
                <span class="score-sep">–</span>
                <span class="side-dire" :class="{ 'nav-winner': match.didRadiantWin === false }">{{ teamKills.dire }}</span>
              </span>
            </button>
            <LaneCard
              v-for="group in laneCards"
              :key="group.key"
              :group="group"
              :active="activeSection === `lane-${group.key}`"
              @select="scrollToLane"
            />
          </div>
        </aside>

        <div class="match-content">
      <!-- Overview -->
      <section id="overview" data-section class="panel summary">
        <div class="summary-top">
          <div class="team-side">
            <span class="team-label radiant-label">Radiant</span>
            <span v-if="match.didRadiantWin === true" class="team-result">Victory</span>
          </div>
          <div class="summary-center">
            <div class="score" :aria-label="`Kills: Radiant ${teamKills.radiant}, Dire ${teamKills.dire}`">
              <span class="side-radiant">{{ teamKills.radiant }}</span>
              <span class="score-sep">–</span>
              <span class="side-dire">{{ teamKills.dire }}</span>
            </div>
            <div class="summary-meta">{{ formatTime(match.durationSeconds) }}</div>
          </div>
          <div class="team-side team-side-right">
            <span v-if="match.didRadiantWin === false" class="team-result">Victory</span>
            <span class="team-label dire-label">Dire</span>
          </div>
        </div>

        <!-- Radiant on the left and Dire on the right, under the matching badges above. -->
        <div class="lineups">
          <TeamLineup v-for="team in rosterTeams" :key="team.key" :team="team" hide-head>
            <template #default="{ player }">
              <button
                type="button"
                class="lineup-tile"
                :disabled="!laneKeyOf(player)"
                :title="`${player.thisMatch?.hero?.displayName ?? 'Hero'} · ${playerName(player)}: jump to their lane`"
                @click="scrollToLane(laneKeyOf(player))"
              >
                <MatchupCard :player="player" :stats="view === 'laning' ? statsAt(player.thisMatch) : null" />
              </button>
            </template>
          </TeamLineup>
        </div>

        <div class="summary-body">
          <div v-if="teamSeries.length" class="summary-chart">
            <!-- Toggles rather than tabs: pick several to overlay them. -->
            <div class="chips" role="group" aria-label="Team chart measures">
              <button
                v-for="tm in teamAvailable"
                :key="tm.key"
                type="button"
                :aria-pressed="teamSeries.some(s => s.key === tm.key)"
                :class="{ active: teamSeries.some(s => s.key === tm.key) }"
                @click="toggleTeamMetric(tm.key)"
              >{{ tm.tab }}</button>
            </div>
            <TeamChart :series="teamSeries" :height="170" fill />
          </div>
          <div v-if="facts.length" class="facts-card">
            <div class="section-label">{{ view === 'laning' ? `Laning · 0–${LANE_MINUTE} min` : 'Match' }}</div>
            <dl class="facts">
              <div v-for="f in facts" :key="f.label" class="fact">
                <dt>{{ f.label }}</dt>
                <dd v-if="f.firstBlood">
                  <HeroIcon v-if="f.firstBlood.killer" :hero="f.firstBlood.killer" class="fact-hero" />
                  <span class="fb-verb">{{ f.firstBlood.killer ? 'killed' : 'died' }}</span>
                  <HeroIcon :hero="f.firstBlood.victim" class="fact-hero" />
                  <span class="fb-time">{{ f.value }}</span>
                </dd>
                <dd v-else-if="f.parts">
                  <span v-for="(part, i) in f.parts" :key="i" :class="part.side ? `side-${part.side}` : 'fact-sep'">{{ part.text }}</span>
                </dd>
                <dd v-else-if="f.hero">
                  <HeroIcon :hero="f.hero" class="fact-hero" />
                  <span :class="f.side && `side-${f.side}`">{{ f.value }}</span>
                </dd>
                <dd v-else :class="f.side && `side-${f.side}`">{{ f.value }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <!-- Lanes -->
      <section v-for="group in laneGroups" :id="`lane-${group.key}`" :key="group.key" data-section class="panel lane-panel">
        <header class="lane-head">
          <h2 class="lane-title">{{ group.label }}</h2>
          <!-- Shown beside the breakdown when there is one. -->
          <LaneOutcome v-if="group.outcome && !group.breakdown" :outcome="group.outcome" />
          <span v-if="group.radiantRole" class="lane-roles">
            Radiant {{ group.radiantRole.toLowerCase() }} vs Dire {{ group.direRole.toLowerCase() }}
          </span>
        </header>

        <div v-if="group.leads" class="lane-chart">
          <div class="chips" role="radiogroup" :aria-label="`${group.label} chart metric`">
            <button
              v-for="m in LANE_METRICS"
              :key="m.key"
              role="radio"
              :aria-checked="(laneMetric[group.key] ?? 'networth') === m.key"
              :class="{ active: (laneMetric[group.key] ?? 'networth') === m.key }"
              @click="laneMetric[group.key] = m.key"
            >{{ m.tab }}</button>
          </div>
          <LeadChart
            :values="laneChart(group).values"
            :extras="laneChart(group).extras"
            :label="laneChart(group).label"
            :heroes="laneChart(group).heroes"
            :step="group.leads.step"
            :height="170"
          />
        </div>

        <div class="lane-body" :class="{ 'has-side': group.breakdown }">
        <aside v-if="group.breakdown" class="lane-side">
          <LaneBreakdown :breakdown="group.breakdown" :outcome="group.outcome" :minute="LANE_MINUTE" />
        </aside>

        <div class="lane-players">
          <div class="side-head side-head-r"><i class="side-key key-radiant" />Radiant</div>
          <div class="side-head side-head-d"><i class="side-key key-dire" />Dire</div>
          <template v-for="(row, ri) in group.rows" :key="`row-${ri}`">
            <template v-for="(p, side) in [row.radiant, row.dire]" :key="`cell-${ri}-${side}`">
              <div v-if="!p" class="player-card-spacer" />
              <div v-else class="player-card" :class="side === 0 ? 'card-radiant' : 'card-dire'">

                <div class="player-header">
                  <img v-if="playerAvatar(p)" :src="playerAvatar(p)" class="avatar" alt="" />
                  <div v-else class="avatar avatar-empty" />
                  <div class="player-info">
                    <div class="name-row">
                      <span class="name-main">
                        <RankMedal
                          v-if="playerData[p.accountId]?.steamAccount?.seasonRank"
                          :rank="playerData[p.accountId].steamAccount.seasonRank"
                          :leaderboard-rank="playerData[p.accountId].steamAccount.seasonLeaderboardRank"
                        />
                        <span class="player-name">{{ playerName(p) }}</span>
                      </span>
                      <span v-if="dataLoading[p.accountId]" class="skel skel-roles" />
                      <template v-else-if="playerRoles(p.accountId).length">
                        <span class="name-divider" aria-hidden="true" />
                        <span class="role-badges">
                          <span v-for="pos in playerRoles(p.accountId)" :key="pos" class="role-badge"><RoleIcon :position="pos" /></span>
                        </span>
                      </template>
                    </div>
                    <div v-if="dataLoading[p.accountId]" class="overall-wr">
                      <span class="skel skel-line" style="width: 7.5rem" />
                    </div>
                    <div
                      v-else-if="overallRecord(p)"
                      class="overall-wr"
                      :title="periodComplete(p.accountId) ? 'Ranked win rate, last 3 months' : 'Ranked win rate over the last 100 games; open Player history to count all of the last 3 months'"
                    >
                      <span :class="overallRecord(p).rate >= 50 ? 'wr-good' : 'wr-bad'">{{ overallRecord(p).rate }}%</span>
                      <span class="record">{{ overallRecord(p).wins.toLocaleString() }}W · {{ overallRecord(p).losses.toLocaleString() }}L</span>
                      <span v-if="periodLoading[p.accountId]" class="record">counting…</span>
                      <span v-else-if="!periodComplete(p.accountId)" class="record">· last 100</span>
                    </div>
                    <div v-else-if="playerData[p.accountId] && !isPrivate(p)" class="overall-wr">
                      <span class="record">No ranked games · 3 months</span>
                    </div>
                  </div>
                  <div v-if="p.accountId" class="profile-links">
                    <a :href="`https://stratz.com/players/${p.accountId}`" target="_blank" rel="noopener noreferrer" class="profile-link" title="Open Stratz profile" aria-label="Open Stratz profile">
                      <StratzIcon class="profile-logo" />
                    </a>
                    <a :href="`https://www.opendota.com/players/${p.accountId}/overview`" target="_blank" rel="noopener noreferrer" class="profile-link" title="Open OpenDota profile" aria-label="Open OpenDota profile">
                      <img :src="OPENDOTA_ICON" class="profile-logo" alt="" />
                    </a>
                    <a :href="`https://www.dotabuff.com/players/${p.accountId}`" target="_blank" rel="noopener noreferrer" class="profile-link" title="Open Dotabuff profile" aria-label="Open Dotabuff profile">
                      <img :src="DOTABUFF_ICON" class="profile-logo" alt="" />
                    </a>
                  </div>
                </div>

                <template v-if="p.thisMatch">
                  <div class="hero-line">
                    <HeroIcon :hero="p.thisMatch.hero" wide class="hero-line-icon" />
                    <span v-if="positionText(p)" class="hero-line-pos">{{ positionText(p) }}</span>
                  </div>

                  <table class="tm-table">
                    <thead>
                      <tr>
                        <th scope="col"><span class="visually-hidden">Stat</span></th>
                        <!-- Each column doubles as the time range toggle, same as the sidebar's. The header buttons
                             give keyboard access; their clicks bubble up to the cell handlers. -->
                        <th v-if="statsAt(p.thisMatch)" scope="col" class="col-laning" :class="{ focus: view === 'laning' }" @click="view = 'laning'">
                          <button type="button" class="tm-col" :aria-pressed="view === 'laning'">@ {{ LANE_MINUTE }}:00</button>
                        </th>
                        <th scope="col" class="col-full" :class="{ focus: view === 'full' }" @click="view = 'full'">
                          <button type="button" class="tm-col" :aria-pressed="view === 'full'">End of Game</button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in matchStatRows(p)"
                        :key="row.label"
                        :class="{ 'stat-hover': hoveredStat === `${group.key}:${ri}:${row.label}` }"
                        @mouseenter="hoveredStat = `${group.key}:${ri}:${row.label}`"
                        @mouseleave="hoveredStat = null"
                      >
                        <th scope="row">{{ row.label }}</th>
                        <td v-if="statsAt(p.thisMatch)" class="col-laning" :class="{ focus: view === 'laning' }" @click="view = 'laning'">{{ row.at ?? '—' }}</td>
                        <td class="col-full" :class="{ focus: view === 'full' }" @click="view = 'full'">{{ row.total ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div v-if="!itemMap.size && itemsLoading" class="section items-section">
                    <span class="skel skel-line" style="width: 6rem; margin-bottom: 0.5rem" />
                    <div class="skel-items"><span v-for="i in 6" :key="i" class="skel skel-item" /></div>
                  </div>
                  <div v-else-if="itemMap.size && playerItems(p).length" class="section items-section">
                    <div class="section-label">{{ view === 'laning' ? `Items by ${LANE_MINUTE}:00` : 'Final items' }}</div>
                    <ItemRow :items="playerItems(p)" :item-map="itemMap" />
                  </div>
                </template>

                <button
                  class="history-toggle"
                  :aria-expanded="!!historyOpen[cardKey(p)]"
                  @click="toggleHistory(p)"
                >
                  <span>Player History</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" :class="{ open: historyOpen[cardKey(p)] }">
                    <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                <div v-if="historyOpen[cardKey(p)]" class="history">
                  <div v-if="dataLoading[p.accountId]" class="section" aria-busy="true" aria-label="Loading player history">
                    <span class="skel skel-line" style="width: 9rem; margin-bottom: 0.6rem" />
                    <span v-for="i in 5" :key="i" class="skel skel-row" />
                  </div>
                  <div v-else-if="isPrivate(p)" class="private-profile">
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/>
                    </svg>
                    Private Profile
                  </div>
                  <template v-else>
                    <div class="section">
                      <div class="section-label">Top Ranked Heroes · 3 Months</div>
                      <div v-if="periodLoading[p.accountId]" aria-busy="true" aria-label="Counting ranked games">
                        <span v-for="i in 5" :key="i" class="skel skel-row" />
                      </div>
                      <template v-else>
                      <div v-if="!topHeroes(p.accountId).length" class="no-data">No data</div>
                      <div v-else class="top-hero-row list-head">
                        <span class="list-head-hero">Hero</span>
                        <span class="spacer-cell" />
                        <span class="spacer-cell" />
                        <span>Record</span>
                        <span>Win %</span>
                      </div>
                      <div v-for="h in topHeroes(p.accountId)" :key="h.heroId" class="top-hero-row">
                        <HeroIcon :hero="h.hero" class="top-hero-icon" />
                        <span class="hero-name">{{ h.hero?.displayName ?? '—' }}</span>
                        <span class="spacer-cell" />
                        <span class="spacer-cell" />
                        <span class="record">{{ h.winCount }}W · {{ h.matchCount - h.winCount }}L</span>
                        <span :class="winRate(h) >= 50 ? 'wr-good' : 'wr-bad'">{{ winRate(h) }}%</span>
                      </div>
                      </template>
                    </div>

                    <div class="section">
                      <div class="section-label">Recent Ranked Matches</div>
                      <div v-if="!recentMatches(p.accountId).length" class="no-data">No data</div>
                      <div v-else class="match-row list-head">
                        <span class="list-head-hero">Hero</span>
                        <span />
                        <span>KDA</span>
                        <span>Length</span>
                        <span>When</span>
                      </div>
                      <RouterLink
                        v-for="m in recentMatches(p.accountId)"
                        :key="m.id"
                        :to="{ query: { ...route.query, match: String(m.id) } }"
                        class="match-row match-link"
                        :title="`Open match ${m.id}`"
                      >
                        <HeroIcon :hero="m.players?.[0]?.hero" class="match-hero-icon" />
                        <span class="hero-name">{{ m.players?.[0]?.hero?.displayName ?? '—' }}</span>
                        <span class="match-result" :class="matchWon(m) ? 'win' : 'loss'">{{ matchWon(m) ? 'W' : 'L' }}</span>
                        <span class="match-kda">{{ m.players?.[0]?.kills }}/{{ m.players?.[0]?.deaths }}/{{ m.players?.[0]?.assists }}</span>
                        <span class="match-duration">{{ formatTime(m.durationSeconds) }}</span>
                        <span class="match-ago">{{ timeAgo(m.startDateTime) }}</span>
                      </RouterLink>
                      <button
                        v-if="recentMatches(p.accountId).length >= 10 && !noMoreMatches[p.accountId]"
                        class="show-more-btn"
                        :disabled="moreLoading[p.accountId]"
                        @click="showMoreMatches(p.accountId)"
                      >
                        {{ moreLoading[p.accountId] ? 'Loading…' : 'Show More' }}
                      </button>
                    </div>
                  </template>
                </div>
              </div>
            </template>
          </template>
        </div>
        </div>
      </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.scout-page {
  max-width: 1680px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.scout-header {
  text-align: center;
  margin-bottom: 1.5rem;
}
.scout-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-text);
}
.search-row {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}
.match-input {
  background: var(--color-surface, #1a1f2b);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.95rem;
  padding: 0.6rem 1rem;
  width: 300px;
  max-width: 100%;
  outline: none;
}
.match-input:focus { border-color: var(--color-accent, #34bfff); }
.load-btn {
  background: var(--color-accent, #34bfff);
  border: none;
  border-radius: 6px;
  color: #000;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.6rem 1.4rem;
  transition: opacity 0.15s;
}
.load-btn { display: inline-flex; align-items: center; gap: 0.45rem; }
.load-btn:disabled { opacity: 0.7; cursor: progress; }
.parse-btn { display: inline-flex; align-items: center; gap: 0.35rem; }
.spin-icon { flex-shrink: 0; }
.spin-icon.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .spin-icon.spinning { animation: none; opacity: 0.6; }
}
.load-btn:hover:not(:disabled) { opacity: 0.85; }
.error-msg {
  color: #ff6b6b;
  margin-top: 0.75rem;
  font-size: 0.88rem;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}

.panel {
  background: var(--color-surface, #1a1f2b);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

/* Not-parsed notice: amber, to read as "incomplete" rather than an error. */
.parse-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(232,168,56,.35);
  border-radius: 10px;
  background: rgba(232,168,56,.08);
}
.parse-icon { flex-shrink: 0; margin-top: 0.1rem; color: #e8a838; }
.parse-text {
  flex: 1 1 18rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--color-muted, #7a8799);
}
.parse-text strong { font-size: 0.85rem; color: var(--color-text); }
.parse-note { font-weight: 600; color: var(--color-text); }
.parse-ok { color: #4bb45f; }
.parse-bad { color: #e06666; }
.parse-actions { display: flex; gap: 0.4rem; align-self: center; flex-wrap: wrap; }
.parse-btn {
  background: transparent;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 999px;
  color: var(--color-text);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.parse-btn:hover:not(:disabled) { border-color: var(--color-muted, #7a8799); }
.parse-primary { background: rgba(232,168,56,.15); border-color: rgba(232,168,56,.45); color: #e8a838; }
.parse-primary:hover:not(:disabled) { background: rgba(232,168,56,.22); border-color: #e8a838; }
.parse-btn:disabled { cursor: progress; opacity: 0.7; }

/* Unparsed matchup: both teams on one row of player cards, Stratz style. */
.roster-title { margin-bottom: 0.85rem; }
.roster-row { display: flex; align-items: center; gap: 0.9rem; }
.roster-team { flex: 1; min-width: 0; }

.roster-vs {
  align-self: center;
  margin-top: 1.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted, #7a8799);
}
/* Too narrow for ten cards: stack the teams. */
@media (max-width: 1000px) {
  .roster-row { flex-direction: column; align-items: stretch; }
  .roster-vs { margin: 0; text-align: center; }
}

/* Match layout: a sticky sidebar of navigation beside the scrolling sections. */
.match-layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}
.match-content { min-width: 0; }
.match-nav {
  position: sticky;
  top: 80px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem;
  background: var(--color-surface, #1a1f2b);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 10px;
}
.nav-toggle {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border, #2e3542);
}
.nav-lanes { display: flex; flex-direction: column; gap: 0.6rem; }
/* Same frame as the lane cards, for jumping back up to the summary. */
.nav-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  font: inherit;
  color: var(--color-text);
  background: rgba(255,255,255,.02);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.nav-summary:hover { border-color: rgba(52,191,255,.4); background: rgba(52,191,255,.05); }
.nav-summary:focus-visible { outline: 2px solid #34bfff; outline-offset: 2px; }
.nav-summary.active { border-color: rgba(52,191,255,.55); background: rgba(52,191,255,.07); box-shadow: inset 3px 0 0 #34bfff; }
.nav-summary-title { font-size: 0.85rem; font-weight: 700; }
.nav-summary-head { display: flex; align-items: baseline; gap: 0.5rem; }
.nav-summary-time { font-size: 0.75rem; color: var(--color-muted, #7a8799); font-variant-numeric: tabular-nums; }
.nav-summary-score { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.nav-summary-score .nav-winner {
  color: #e8c547;
  padding: 0.05rem 0.35rem;
  background: rgba(232,197,71,.12);
  border: 1px solid rgba(232,197,71,.35);
  border-radius: 4px;
}

/* Narrower screens: the sidebar sits above the sections and the lanes go across. */
@media (max-width: 1100px) {
  .match-layout { grid-template-columns: minmax(0, 1fr); }
  .match-nav { position: static; }
  .nav-lanes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .nav-lanes { grid-template-columns: minmax(0, 1fr); }
}

/* Score header: Radiant badge, kills and duration, Dire badge. */
.summary-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.team-side { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.team-side-right { justify-content: flex-end; }
.summary-center { text-align: center; }
.summary-meta { font-size: 0.75rem; color: var(--color-muted, #7a8799); font-variant-numeric: tabular-nums; }

/* Overview: both lineups side by side above the chart and facts. */
.lineups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--color-border, #2e3542);
}
/* Each player's card in the lineup jumps to the lane they were in. */
.lineup-tile {
  display: flex;
  min-width: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.lineup-tile .matchup-card { flex: 1; transition: border-color 0.15s, background 0.15s; }
.lineup-tile:hover:not(:disabled) .matchup-card { border-color: rgba(52,191,255,.55); background: rgba(52,191,255,.06); }
.lineup-tile:focus-visible { outline: 2px solid #34bfff; outline-offset: 2px; }
.lineup-tile:disabled { cursor: default; }
@media (max-width: 900px) {
  .lineups { grid-template-columns: minmax(0, 1fr); }
}

.team-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
}
.radiant-label { background: rgba(75,180,95,.15); color: #4bb45f; border: 1px solid rgba(75,180,95,.3); }
.dire-label    { background: rgba(200,60,60,.15);  color: #c83c3c; border: 1px solid rgba(200,60,60,.3); }
/* Same gold box as the winning kill count in the sidebar. */
.team-result {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #e8c547;
  padding: 0.15rem 0.5rem;
  background: rgba(232,197,71,.12);
  border: 1px solid rgba(232,197,71,.35);
  border-radius: 4px;
}
.score {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}
.score-sep { color: var(--color-muted, #7a8799); }

/* Pill chips for the view and graph metric pickers. */
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
.chips button {
  background: transparent;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 999px;
  color: var(--color-muted, #7a8799);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.chips button.active { background: rgba(52,191,255,.15); border-color: rgba(52,191,255,.3); color: #34bfff; }
.chips button:hover:not(.active) { color: var(--color-text); border-color: var(--color-muted, #7a8799); }
/* The page-level time range picker: centred and a touch larger than the graph chips. */
/* The time range picker: full-width in the sidebar, a touch larger than the graph chips. */
.view-toggle { margin: 0; flex-wrap: nowrap; }
.view-toggle button { flex: 1; font-size: 0.74rem; padding: 0.4rem 0.6rem; white-space: nowrap; }

.summary-body {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 1.25rem;
  align-items: stretch;
}
/* The chart grows to the facts card's height. */
.summary-chart { display: flex; flex-direction: column; min-width: 0; }
.summary-chart .team-chart { flex: 1; }
/* Framed like the lane cards, with rows styled after the lane breakdown table. */
.facts-card {
  padding: 0.75rem 0.85rem;
  background: rgba(255,255,255,.02);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
}
.facts { margin: 0; display: flex; flex-direction: column; }
.fact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 1.9rem;
  padding: 0.3rem 0;
}
.fact + .fact { border-top: 1px solid var(--color-border, #2e3542); }
.fact dt { font-size: 0.73rem; color: var(--color-muted, #7a8799); }
.fact dd {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.side-radiant { color: #4bb45f; }
.side-dire { color: #c83c3c; }
.fact-sep { color: var(--color-muted, #7a8799); font-weight: 500; }
.fact-hero { width: 20px; height: 20px; border-radius: 3px; }
.fb-verb { font-size: 0.7rem; font-weight: 500; color: var(--color-muted, #7a8799); }
.fb-time { margin-left: 0.2rem; }
/* Clear the sticky app header when the sidebar jumps here. */
.summary,
.lane-panel { scroll-margin-top: 80px; }

.match-note {
  margin: 0.9rem 0 0;
  font-size: 0.7rem;
  color: var(--color-muted, #7a8799);
}

/* Lanes */
.lane-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.9rem;
}
.lane-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}
.lane-roles { font-size: 0.72rem; color: var(--color-muted, #7a8799); }

/* Above the sticky breakdown panel, so tall chart tooltips aren't drawn underneath it. */
.lane-chart { margin-bottom: 1rem; position: relative; z-index: 2; }

.lane-body {
  --card-gap: 0.75rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "players";
  gap: var(--card-gap);
  align-items: start;
}
.lane-body.has-side { grid-template-areas: "side" "players"; }
.lane-side {
  grid-area: side;
  background: #161a24;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  padding: 0.9rem 1rem;
}

.lane-players {
  grid-area: players;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--card-gap);
  align-items: start;
}

/* Column headers over each side's player cards. */
.side-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 0.1rem;
}
.side-head-r { color: #4bb45f; }
.side-head-d { color: #c83c3c; }
.side-key { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
.key-radiant { background: #45a957; }
.key-dire { background: #c83c3c; }

@media (max-width: 900px) {
  .summary-body { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 800px) {
  .lane-players { grid-template-columns: minmax(0, 1fr); }
  .player-card-spacer { display: none; }
  /* One column: the two headers would sit together above mixed cards; the coloured card edges mark sides instead. */
  .side-head { display: none; }
  .summary-top { grid-template-columns: 1fr; text-align: center; }
  .team-side, .team-side-right { justify-content: center; }
}

/* Player cards */
.player-card {
  background: #161a24;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  padding: 0.75rem;
  min-width: 0;
}
.card-radiant { border-left: 3px solid rgba(75,180,95,.7); background: linear-gradient(90deg, rgba(75,180,95,.05), transparent 40%), #161a24; }
.card-dire    { border-left: 3px solid rgba(200,60,60,.7); background: linear-gradient(90deg, rgba(200,60,60,.05), transparent 40%), #161a24; }

.player-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.6rem;
}
.avatar {
  align-self: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-border, #2e3542);
}
.player-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  min-width: 0;
}
.overall-wr {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.profile-links {
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}
.profile-link {
  display: flex;
  padding: 0.2rem;
  border-radius: 50%;
  opacity: 0.85;
  transition: opacity 0.15s, transform 0.15s;
}
.profile-link:hover { opacity: 1; transform: scale(1.08); }
.profile-logo {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
}
.name-divider {
  width: 1px;
  height: 1rem;
  background: var(--color-border, #2e3542);
  flex-shrink: 0;
}
.name-main {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
}
.player-name {
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Own wrapper so the name row's gap doesn't space the badges apart. */
.role-badges { display: inline-flex; align-items: center; gap: .2em; flex-shrink: 0; }
.role-badge {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 0.58rem;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.hero-line {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}
.hero-line-icon {
  width: 52px;
  height: 29px;
  border-radius: 4px;
}
.hero-line-pos {
  font-size: 0.7rem;
  color: var(--color-muted, #7a8799);
  white-space: nowrap;
}

/* Stats as rows, @10 and end of game as columns; the column for the current view is lit. */
.tm-table {
  width: 100%;
  margin-top: 0.6rem;
  /* Separate, not collapsed: cells only take a border radius in this mode. */
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.tm-table th,
.tm-table td { padding: 0.3rem 0.5rem; text-align: right; white-space: nowrap; }
.tm-table thead th {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
  border-bottom: 1px solid var(--color-border, #2e3542);
}
.tm-table tbody th {
  text-align: left;
  padding-left: 0;
  font-weight: 500;
  font-size: 0.72rem;
  color: var(--color-muted, #7a8799);
}
.tm-table tbody tr + tr > * { border-top: 1px solid rgba(255,255,255,.04); }
.tm-table td { color: var(--color-muted, #7a8799); }
.tm-table .focus { color: var(--color-text); font-weight: 600; background-color: rgba(52,191,255,.06); }
.tm-table thead .focus { color: #34bfff; }
.tm-col {
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
}
.col-laning,
.col-full { cursor: pointer; background: rgba(255,255,255,.02); background-clip: padding-box; }
/* Each column reads as its own rounded block, with a 5px gap between the two (a transparent border). */
.tm-table .col-laning { border-right: 5px solid transparent; }
.tm-table thead :is(.col-laning, .col-full) { border-radius: 6px 6px 0 0; }
.tm-table tbody tr:last-child :is(.col-laning, .col-full) { border-radius: 0 0 6px 6px; }
/* Hovering anywhere in the other column lights up that whole column. */
.tm-table:has(.col-laning:hover) .col-laning:not(.focus),
.tm-table:has(.col-full:hover) .col-full:not(.focus) { color: var(--color-text); background-color: rgba(255,255,255,.05); }
/* The hovered stat row, on both heroes facing each other. An overlay image so it sits on top of the
   column tints without replacing them. */
.tm-table tbody tr.stat-hover > * {
  color: var(--color-text);
  background-image: linear-gradient(rgba(255,255,255,.07), rgba(255,255,255,.07));
}
.tm-col:focus-visible { outline: 2px solid #34bfff; outline-offset: 2px; border-radius: 2px; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.history-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.4rem 0.55rem;
  background: transparent;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 5px;
  color: var(--color-muted, #7a8799);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.history-toggle:hover { color: var(--color-text); border-color: #3c4556; }
.history-toggle svg { transition: transform 0.15s; }
.history-toggle svg.open { transform: rotate(180deg); }
.history { margin-top: 0.25rem; }

/* Skeleton placeholders: a soft shimmer, held still for reduced-motion users. */
.skel {
  display: block;
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 75%);
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease-in-out infinite;
}
@keyframes skel-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skel { animation: none; }
}
.skel-line { height: 0.75rem; border-radius: 4px; }
.skel-roles { display: inline-block; width: 52px; height: 24px; border-radius: 4px; }
.skel-row { height: 22px; margin: 0.35rem 0; border-radius: 4px; }
.skel-items { display: flex; gap: 0.3rem; }
.skel-item { width: 32px; height: 24px; border-radius: 3px; }
.skel-chip { width: 7rem; height: 1.7rem; border-radius: 999px; }
.skel-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
@media (max-width: 800px) {
  .skel-cards { grid-template-columns: minmax(0, 1fr); }
}

.section-loading {
  font-size: 0.75rem;
  color: var(--color-muted, #7a8799);
  padding: 0.4rem 0;
}
.private-profile {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
  padding: 0.5rem 0 0.2rem;
}

.section { margin-top: 0.6rem; }
.section:not(:last-child) { padding-bottom: 0.6rem; }
.section-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text);
  border-left: 2px solid var(--color-accent, #34bfff);
  padding-left: 0.45rem;
  line-height: 1.1;
  margin-bottom: 0.5rem;
}
.items-section { margin-top: 0.75rem; }
.no-data {
  font-size: 0.75rem;
  color: var(--color-muted, #7a8799);
}

.top-hero-row,
.match-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 1rem 4.6rem 4.6rem 3.2rem;
  align-items: center;
  column-gap: 0.6rem;
  padding: 0.18rem 0;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 520px) {
  .top-hero-row,
  .match-row { column-gap: 0.4rem; }
  .top-hero-row { grid-template-columns: 22px minmax(0, 1fr) 4.2rem 2.6rem; }
  .top-hero-row .spacer-cell { display: none; }
  .match-row { grid-template-columns: 22px minmax(0, 1fr) 0.8rem 3.6rem 3.2rem 3.3rem; }
}
.top-hero-icon,
.match-hero-icon {
  width: 22px;
  height: 22px;
  border-radius: 3px;
}
.hero-name {
  font-size: 0.78rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Each recent match opens in the scout. */
.match-link {
  color: inherit;
  text-decoration: none;
  margin: 0 -0.4rem;
  padding-left: 0.4rem;
  padding-right: 0.4rem;
  border-radius: 4px;
  transition: background 0.15s;
}
.match-link:hover { background: rgba(52,191,255,.08); }
.match-link:hover .hero-name { color: #34bfff; }
.match-link:focus-visible { outline: 2px solid #34bfff; outline-offset: -2px; }
.wr-good, .wr-bad { font-size: 0.76rem; font-weight: 700; }
.wr-good { color: #4bb45f; }
.wr-bad  { color: #c83c3c; }
.record  { font-size: 0.72rem; color: var(--color-muted, #7a8799); }
.match-result { font-size: 0.74rem; font-weight: 700; }
.win  { color: #4bb45f; }
.loss { color: #c83c3c; }
.match-kda { font-size: 0.74rem; color: var(--color-text); }
.match-duration,
.match-ago {
  font-size: 0.72rem;
  color: var(--color-muted, #7a8799);
}
.list-head {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
  padding-bottom: 0.3rem;
}
.list-head-hero { grid-column: span 2; }

.show-more-btn {
  display: block;
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.35rem;
  background: transparent;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 4px;
  color: var(--color-muted, #7a8799);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.show-more-btn:hover:not(:disabled) {
  color: #fff;
  border-color: #5a6375;
}
.show-more-btn:disabled { opacity: 0.6; cursor: wait; }
</style>
