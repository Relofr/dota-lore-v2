<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchPlayersData,
  fetchMatchPlayers,
  fetchMatchPlayback,
  fetchPlayerMatches,
  fetchRankedPeriodPage,
  fetchItems,
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
import ItemRow from '@/components/scout/ItemRow.vue'
import LaneBreakdown from '@/components/scout/LaneBreakdown.vue'
import HeroIcon from '@/components/scout/HeroIcon.vue'
import RoleIcon from '@/components/scout/RoleIcon.vue'
import LaneCard from '@/components/scout/LaneCard.vue'
import LaneOutcome from '@/components/scout/LaneOutcome.vue'

const OPENDOTA_ICON = 'https://www.opendota.com/assets/images/icons/icon-512x512.png'
const DOTABUFF_ICON = 'https://www.dotabuff.com/assets/favicon-retina-377ae687bcef452311a9c4303e2efcb1a3e9dceeb924084856e960256862b843.png'
const route = useRoute()
const router = useRouter()
const matchIdInput = ref('')
const loading = ref(false)
const error = ref(null)
const match = ref(null)
const view = ref('laning')
const teamMetric = ref('networth')
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

// The three real lanes get a summary card; roamers only appear in the panels below. Full game swaps
// the 10:00 numbers for end-of-game totals.
const laneCards = computed(() => {
  const endMinute = Math.ceil((match.value?.durationSeconds ?? 0) / 60)
  const full = view.value === 'full' && endMinute > 0
  return laneGroups.value.filter(g => g.key !== 'other').map(g => ({
    ...g,
    stats: full ? laneBreakdown(g, players.value, g.outcome, endMinute)?.rows : g.breakdown?.rows,
    statsLabel: full ? 'End of game' : `At ${LANE_MINUTE}:00`,
  }))
})

function scrollToLane(key) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(`lane-${key}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

const TEAM_METRICS = [
  { key: 'networth', tab: 'Net worth', label: 'Team net worth lead' },
  { key: 'experience', tab: 'Experience', label: 'Team experience lead' },
  { key: 'heroDamage', tab: 'Hero damage', label: 'Team hero damage lead' },
]

const teamSeries = computed(() => {
  const m = match.value
  if (!m) return null
  const metric = teamMetric.value
  // Stratz has team-level leads for net worth and XP only; damage is summed from the players.
  if (fine.value || metric === 'heroDamage') {
    const leads = leadSeries(players.value.filter(p => p.isRadiant), players.value.filter(p => !p.isRadiant), fine.value)
    if (leads) return { values: windowed(leads[metric], leads.step), step: leads.step }
    if (metric === 'heroDamage') return null
  }
  const source = metric === 'networth' ? m.radiantNetworthLeads : m.radiantExperienceLeads
  if (!source?.length) return null
  return { values: windowed(source), step: 60 }
})

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
  { key: 'networth', tab: 'Net worth' },
  { key: 'experience', tab: 'Experience' },
  { key: 'heroDamage', tab: 'Hero damage' },
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
      label: 'Lane experience lead',
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
      label: 'Lane hero damage lead',
      values: windowed(leads.heroDamage, leads.step),
      extras: [],
      heroes,
    }
  }
  return {
    label: 'Lane net worth lead',
    values: windowed(leads.networth, leads.step),
    extras: [
      { label: 'XP lead', values: windowed(leads.experience, leads.step) },
      { label: 'Last hit lead', values: windowed(leads.lastHits, leads.step) },
    ],
    heroes,
  }
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

function resetState() {
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

async function loadByMatchId(mid) {
  // The ID is interpolated into the GraphQL query, and shared links make it user-controlled.
  if (!/^\d+$/.test(mid)) {
    resetState()
    error.value = 'Match IDs are numbers only.'
    return
  }
  loading.value = true
  resetState()
  try {
    const data = await fetchMatchPlayers(mid)
    if (!data?.players?.length) {
      error.value = `Match ${mid} not found.`
      return
    }
    match.value = {
      ...data,
      matchId: data.id,
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
    loadAllPlayerData()
    loadPlayback(data.id)
    loadItems()
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
        <button class="load-btn" :disabled="loading" @click="searchMatch">
          {{ loading ? 'Loading…' : 'Load Match' }}
        </button>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </header>

    <!-- Placeholder shaped like the summary and a lane while the match loads. -->
    <div v-if="loading && !match" class="scout-skeleton" aria-busy="true" aria-label="Loading match">
      <section class="panel summary">
        <div class="skel-summary-top">
          <span class="skel" style="width: 5rem; height: 1rem" />
          <span class="skel" style="width: 6rem; height: 1.8rem" />
          <span class="skel" style="width: 5rem; height: 1rem" />
        </div>
        <div class="skel-chips">
          <span class="skel skel-chip" /><span class="skel skel-chip" />
        </div>
        <div class="summary-body">
          <span class="skel" style="height: 220px" />
          <span class="skel" style="height: 220px" />
        </div>
        <div class="lane-cards">
          <span v-for="i in 3" :key="i" class="skel" style="height: 190px" />
        </div>
      </section>
      <section v-for="i in 2" :key="i" class="panel lane-panel">
        <span class="skel" style="width: 8rem; height: 1.1rem; margin-bottom: 0.9rem" />
        <span class="skel" style="height: 170px; margin-bottom: 1rem" />
        <div class="skel-cards">
          <span v-for="j in 2" :key="j" class="skel" style="height: 150px" />
        </div>
      </section>
    </div>

    <template v-if="match">
      <!-- Match summary -->
      <section class="panel summary">
        <div class="summary-top">
          <div class="team-side">
            <span class="team-label radiant-label">Radiant</span>
            <span v-if="match.didRadiantWin === true" class="team-result">Victory</span>
          </div>
          <div class="summary-center">
            <div class="score">
              <span>{{ teamKills.radiant }}</span>
              <span class="score-sep">–</span>
              <span>{{ teamKills.dire }}</span>
            </div>
            <div class="summary-meta">
              {{ formatTime(match.durationSeconds) }}
            </div>
          </div>
          <div class="team-side team-side-right">
            <span v-if="match.didRadiantWin === false" class="team-result">Victory</span>
            <span class="team-label dire-label">Dire</span>
          </div>
        </div>

        <div class="chips view-toggle" role="tablist" aria-label="Time range">
          <button
            role="tab"
            :aria-selected="view === 'laning'"
            :class="{ active: view === 'laning' }"
            @click="view = 'laning'"
          >Laning · 0–{{ LANE_MINUTE }} min</button>
          <button
            role="tab"
            :aria-selected="view === 'full'"
            :class="{ active: view === 'full' }"
            @click="view = 'full'"
          >Full game</button>
        </div>

        <div class="summary-body">
          <div v-if="teamSeries" class="summary-chart">
            <div class="chips" role="radiogroup" aria-label="Team lead metric">
              <button
                v-for="tm in TEAM_METRICS"
                :key="tm.key"
                role="radio"
                :aria-checked="teamMetric === tm.key"
                :class="{ active: teamMetric === tm.key }"
                @click="teamMetric = tm.key"
              >{{ tm.tab }}</button>
            </div>
            <LeadChart
              :values="teamSeries.values"
              :step="teamSeries.step"
              :label="TEAM_METRICS.find(tm => tm.key === teamMetric).label"
              :height="170"
              fill
            />
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
        <div v-if="laneCards.length" class="lane-cards">
          <LaneCard
            v-for="group in laneCards"
            :key="group.key"
            :group="group"
            :stats="group.stats ?? []"
            :stats-label="group.statsLabel"
            @select="scrollToLane"
          />
        </div>
      </section>

      <!-- Lanes -->
      <section v-for="group in laneGroups" :id="`lane-${group.key}`" :key="group.key" class="panel lane-panel">
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

                  <div class="this-match-table">
                    <div class="tm-row tm-head">
                      <span>Stat</span>
                      <span>Lvl</span>
                      <span>KDA</span>
                      <span>LH/DN</span>
                      <span>GPM/XPM</span>
                      <span>NW</span>
                      <span>Dmg</span>
                    </div>
                    <div v-if="statsAt(p.thisMatch)" class="tm-row" :class="{ 'tm-focus': view === 'laning' }">
                      <span class="tm-key">@{{ LANE_MINUTE }}</span>
                      <span>{{ statsAt(p.thisMatch).level }}</span>
                      <span>{{ statsAt(p.thisMatch).kills }}/{{ statsAt(p.thisMatch).deaths }}/{{ statsAt(p.thisMatch).assists }}</span>
                      <span>{{ statsAt(p.thisMatch).lastHits }}/{{ statsAt(p.thisMatch).denies }}</span>
                      <span>{{ statsAt(p.thisMatch).gpm }}/{{ statsAt(p.thisMatch).xpm }}</span>
                      <span>{{ compact(statsAt(p.thisMatch).networth) }}</span>
                      <span>{{ compact(statsAt(p.thisMatch).heroDamage) }}</span>
                    </div>
                    <div class="tm-row" :class="{ 'tm-focus': view === 'full' }">
                      <span class="tm-key">Total</span>
                      <span>{{ p.thisMatch.level ?? '—' }}</span>
                      <span>{{ p.thisMatch.kills }}/{{ p.thisMatch.deaths }}/{{ p.thisMatch.assists }}</span>
                      <span>{{ p.thisMatch.numLastHits }}/{{ p.thisMatch.numDenies }}</span>
                      <span>{{ p.thisMatch.goldPerMinute }}/{{ p.thisMatch.experiencePerMinute }}</span>
                      <span>{{ compact(p.thisMatch.networth) }}</span>
                      <span>{{ compact(p.thisMatch.heroDamage) }}</span>
                    </div>
                  </div>

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
                  <span>Player history</span>
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
                        {{ moreLoading[p.accountId] ? 'Loading…' : 'Show more' }}
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
.load-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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

/* Summary */
.summary-top {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}
.team-side { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.team-side-right { justify-content: flex-end; }
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
.team-result {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text);
}
.summary-center { text-align: center; }
.score {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text);
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}
.score-sep { color: var(--color-muted, #7a8799); }
.summary-meta { font-size: 0.75rem; color: var(--color-muted, #7a8799); }
.summary-meta strong { color: var(--color-text); font-variant-numeric: tabular-nums; }

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
.view-toggle { justify-content: center; margin: 1rem 0 0.75rem; }
.view-toggle button { font-size: 0.75rem; padding: 0.35rem 0.9rem; }

.summary-body {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 1.25rem;
  align-items: stretch;
}
/* The chart grows to the facts card's height. */
.summary-chart { display: flex; flex-direction: column; min-width: 0; }
.summary-chart .lead-chart { flex: 1; }
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
.lane-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.1rem;
}
/* Clear the sticky app header when a lane card scrolls here. */
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
.lane-body.has-side {
  grid-template-columns: minmax(0, 1fr) minmax(360px, 420px);
  grid-template-areas: "players side";
}
.lane-side {
  grid-area: side;
  position: sticky;
  top: calc(64px + 1rem);
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

/* Two player-card columns need ~1150px; below that the breakdown moves above them. */
@media (max-width: 1600px) {
  .lane-body.has-side {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "side" "players";
  }
  .lane-side { position: static; }
}
@media (max-width: 900px) {
  .summary-body { grid-template-columns: minmax(0, 1fr); }
  .lane-cards { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 800px) {
  .lane-players { grid-template-columns: minmax(0, 1fr); }
  .player-card-spacer { display: none; }
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
.card-radiant { border-left: 3px solid rgba(75,180,95,.6); }
.card-dire    { border-left: 3px solid rgba(200,60,60,.6); }

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

.this-match-table {
  margin-top: 0.5rem;
  overflow-x: auto;
}
.tm-row {
  display: grid;
  grid-template-columns: 2.4rem 1.8rem minmax(3.6rem, 1fr) minmax(3rem, 1fr) minmax(4.4rem, 1fr) minmax(2.8rem, 1fr) minmax(2.8rem, 1fr);
  column-gap: 0.5rem;
  align-items: center;
  padding: 0.18rem 0;
  font-size: 0.78rem;
  color: var(--color-muted, #7a8799);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tm-row.tm-focus { color: var(--color-text); }
.tm-key {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
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
.skel-summary-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.skel-chips { display: flex; justify-content: center; gap: 0.35rem; margin: 1rem 0 0.75rem; }
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
.list-head,
.tm-head {
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
