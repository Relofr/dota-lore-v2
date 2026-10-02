<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  fetchPlayersData,
  fetchMatchPlayers,
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
  laneBreakdown,
  laneOutcomeText,
  gameFacts,
} from '@/utils/matchAnalysis.js'
import StratzIcon from '@/components/StratzIcon.vue'
import RankMedal from '@/components/RankMedal.vue'
import LeadChart from '@/components/scout/LeadChart.vue'
import ItemRow from '@/components/scout/ItemRow.vue'
import LaneBreakdown from '@/components/scout/LaneBreakdown.vue'

const HERO_ICON = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons'
const OPENDOTA_ICON = 'https://www.opendota.com/assets/images/icons/icon-512x512.png'
const DOTABUFF_ICON = 'https://www.dotabuff.com/assets/favicon-retina-377ae687bcef452311a9c4303e2efcb1a3e9dceeb924084856e960256862b843.png'
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

onMounted(() => {
  fetchItems()
    .then(map => { itemMap.value = map })
    .catch(err => console.error('[Scout] items:', err.message))
})

const players = computed(() => match.value?.players ?? [])

const laneGroups = computed(() => groupByLane(players.value).map(group => {
  const outcome = laneOutcomeText(match.value?.laneOutcomes?.[group.key])
  return {
    ...group,
    outcome,
    leads: laneLeads(group),
    breakdown: laneBreakdown(group, players.value, outcome),
    rows: pairUp(group.radiant, group.dire),
  }
}))

const facts = computed(() => gameFacts(match.value, view.value))

const teamSeries = computed(() => {
  const m = match.value
  if (!m) return null
  const source = teamMetric.value === 'networth' ? m.radiantNetworthLeads : m.radiantExperienceLeads
  if (!source?.length) return null
  return view.value === 'laning' ? source.slice(0, LANE_MINUTE + 1) : source
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

function windowed(values) {
  return view.value === 'laning' ? values.slice(0, LANE_MINUTE + 1) : values
}

const LANE_METRICS = [
  { key: 'networth', tab: 'Net worth' },
  { key: 'experience', tab: 'Experience' },
  { key: 'heroDamage', tab: 'Hero damage' },
]

function laneChart(group) {
  const leads = group.leads
  const metric = laneMetric.value[group.key] ?? 'networth'
  if (metric === 'experience') {
    return {
      label: 'Lane experience lead',
      values: windowed(leads.experience),
      extras: [
        { label: 'Net worth lead', values: windowed(leads.networth) },
        { label: 'Last hit lead', values: windowed(leads.lastHits) },
      ],
    }
  }
  if (metric === 'heroDamage') {
    return {
      label: 'Hero damage per minute lead',
      values: windowed(leads.heroDamage),
      extras: [{ label: 'Total damage lead', values: windowed(leads.heroDamageTotal) }],
    }
  }
  return {
    label: 'Lane net worth lead',
    values: windowed(leads.networth),
    extras: [
      { label: 'XP lead', values: windowed(leads.experience) },
      { label: 'Last hit lead', values: windowed(leads.lastHits) },
    ],
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

function toggleHistory(key) {
  historyOpen.value[key] = !historyOpen.value[key]
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
    .map(([pos]) => POSITION_LABELS[pos] ?? pos)
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

// The first page comes with the batched query; players at the page cap get the rest fetched one page at a time.
async function loadRestOfPeriod(accountId) {
  const data = playerData.value[accountId]
  if (!data?.recentPeriod || data.recentPeriod.length < PERIOD_PAGE_SIZE) return
  periodLoading.value[accountId] = true
  try {
    let page
    do {
      page = await fetchRankedPeriodPage(accountId, data.recentPeriod.length)
      data.recentPeriod = [...data.recentPeriod, ...page]
    } while (page.length === PERIOD_PAGE_SIZE)
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
  for (const id of ids) await loadRestOfPeriod(id)
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
  error.value = null
}

async function loadByMatchId() {
  const mid = matchIdInput.value.trim()
  if (!mid) return
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
          @keydown.enter="loadByMatchId"
        />
        <button class="load-btn" :disabled="loading" @click="loadByMatchId">
          {{ loading ? 'Loading…' : 'Load Match' }}
        </button>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </header>

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
              Match <strong>{{ match.matchId }}</strong> · {{ formatTime(match.durationSeconds) }}
            </div>
          </div>
          <div class="team-side team-side-right">
            <span v-if="match.didRadiantWin === false" class="team-result">Victory</span>
            <span class="team-label dire-label">Dire</span>
          </div>
        </div>

        <div class="view-toggle" role="tablist" aria-label="Time range">
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
            <div class="metric-toggle" role="radiogroup" aria-label="Team lead metric">
              <button
                role="radio"
                :aria-checked="teamMetric === 'networth'"
                :class="{ active: teamMetric === 'networth' }"
                @click="teamMetric = 'networth'"
              >Net worth</button>
              <button
                role="radio"
                :aria-checked="teamMetric === 'experience'"
                :class="{ active: teamMetric === 'experience' }"
                @click="teamMetric = 'experience'"
              >Experience</button>
            </div>
            <LeadChart
              :values="teamSeries"
              :label="teamMetric === 'networth' ? 'Team net worth lead' : 'Team experience lead'"
              :height="170"
            />
          </div>
          <dl class="facts">
            <div v-for="f in facts" :key="f.label" class="fact">
              <dt>{{ f.label }}</dt>
              <dd>{{ f.value }}</dd>
            </div>
          </dl>
        </div>
        <p class="match-note">
          Player history covers ranked matches only; win rates and top heroes use the last 3 months.
        </p>
      </section>

      <!-- Lanes -->
      <section v-for="group in laneGroups" :key="group.key" class="panel lane-panel">
        <header class="lane-head">
          <h2 class="lane-title">{{ group.label }}</h2>
          <span v-if="group.outcome" class="lane-outcome" :class="`lane-${group.outcome.side}`">
            {{ group.outcome.text }}
          </span>
          <span v-if="group.radiantRole" class="lane-roles">
            Radiant {{ group.radiantRole.toLowerCase() }} vs Dire {{ group.direRole.toLowerCase() }}
          </span>
        </header>

        <div v-if="group.leads" class="lane-chart">
          <div class="metric-toggle" role="radiogroup" :aria-label="`${group.label} chart metric`">
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
            :height="170"
          />
        </div>

        <div class="lane-body" :class="{ 'has-side': group.breakdown }">
        <aside v-if="group.breakdown" class="lane-side">
          <LaneBreakdown :breakdown="group.breakdown" :minute="LANE_MINUTE" />
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
                      <template v-if="!dataLoading[p.accountId] && playerRoles(p.accountId).length">
                        <span class="name-divider" aria-hidden="true" />
                        <span v-for="role in playerRoles(p.accountId)" :key="role" class="role-badge">{{ role }}</span>
                      </template>
                    </div>
                    <div v-if="overallRecord(p)" class="overall-wr" title="Ranked win rate, last 3 months">
                      <span :class="overallRecord(p).rate >= 50 ? 'wr-good' : 'wr-bad'">{{ overallRecord(p).rate }}%</span>
                      <span class="record">{{ overallRecord(p).wins.toLocaleString() }}W · {{ overallRecord(p).losses.toLocaleString() }}L</span>
                      <span v-if="periodLoading[p.accountId]" class="record">counting…</span>
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
                    <img
                      v-if="p.thisMatch.hero?.shortName"
                      :src="`${HERO_ICON}/${p.thisMatch.hero.shortName}.png`"
                      class="hero-line-icon"
                      alt=""
                    />
                    <span class="hero-line-name">{{ p.thisMatch.hero?.displayName ?? '—' }}</span>
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

                  <div v-if="itemMap.size && playerItems(p).length" class="section items-section">
                    <div class="section-label">{{ view === 'laning' ? `Items by ${LANE_MINUTE}:00` : 'Final items' }}</div>
                    <ItemRow :items="playerItems(p)" :item-map="itemMap" />
                  </div>
                </template>

                <button
                  class="history-toggle"
                  :aria-expanded="!!historyOpen[cardKey(p)]"
                  @click="toggleHistory(cardKey(p))"
                >
                  <span>Player history</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" :class="{ open: historyOpen[cardKey(p)] }">
                    <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                <div v-if="historyOpen[cardKey(p)]" class="history">
                  <div v-if="dataLoading[p.accountId]" class="section-loading">Loading stats…</div>
                  <div v-else-if="isPrivate(p)" class="private-profile">
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/>
                    </svg>
                    Private Profile
                  </div>
                  <template v-else>
                    <div class="section">
                      <div class="section-label">Top Ranked Heroes · 3 Months</div>
                      <div v-if="!topHeroes(p.accountId).length" class="no-data">No data</div>
                      <div v-else class="top-hero-row list-head">
                        <span class="list-head-hero">Hero</span>
                        <span class="spacer-cell" />
                        <span class="spacer-cell" />
                        <span>Record</span>
                        <span>Win %</span>
                      </div>
                      <div v-for="h in topHeroes(p.accountId)" :key="h.heroId" class="top-hero-row">
                        <img v-if="h.hero?.shortName" :src="`${HERO_ICON}/${h.hero.shortName}.png`" class="top-hero-icon" alt="" />
                        <span v-else />
                        <span class="top-hero-name">{{ h.hero?.displayName }}</span>
                        <span class="spacer-cell" />
                        <span class="spacer-cell" />
                        <span class="record">{{ h.winCount }}W · {{ h.matchCount - h.winCount }}L</span>
                        <span :class="winRate(h) >= 50 ? 'wr-good' : 'wr-bad'">{{ winRate(h) }}%</span>
                      </div>
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
                      <div v-for="m in recentMatches(p.accountId)" :key="m.id" class="match-row">
                        <img v-if="m.players?.[0]?.hero?.shortName" :src="`${HERO_ICON}/${m.players[0].hero.shortName}.png`" class="match-hero-icon" alt="" />
                        <span v-else />
                        <span class="match-hero-name">{{ m.players?.[0]?.hero?.displayName ?? '—' }}</span>
                        <span class="match-result" :class="matchWon(m) ? 'win' : 'loss'">{{ matchWon(m) ? 'W' : 'L' }}</span>
                        <span class="match-kda">{{ m.players?.[0]?.kills }}/{{ m.players?.[0]?.deaths }}/{{ m.players?.[0]?.assists }}</span>
                        <span class="match-duration">{{ formatTime(m.durationSeconds) }}</span>
                        <span class="match-ago">{{ timeAgo(m.startDateTime) }}</span>
                      </div>
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

.view-toggle,
.metric-toggle {
  display: inline-flex;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 6px;
  overflow: hidden;
}
.view-toggle { display: flex; width: fit-content; margin: 1rem auto 0.75rem; }
.view-toggle button,
.metric-toggle button {
  background: transparent;
  border: none;
  color: var(--color-muted, #7a8799);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
}
.metric-toggle { margin-bottom: 0.5rem; }
.metric-toggle button { font-size: 0.68rem; padding: 0.25rem 0.65rem; }
.view-toggle button + button,
.metric-toggle button + button { border-left: 1px solid var(--color-border, #2e3542); }
.view-toggle button.active,
.metric-toggle button.active { background: rgba(255,255,255,.1); color: #fff; }
.view-toggle button:hover:not(.active),
.metric-toggle button:hover:not(.active) { color: var(--color-text); }

.summary-body {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 1.25rem;
  align-items: start;
}
.facts { margin: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.fact { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.78rem; }
.fact dt { color: var(--color-muted, #7a8799); }
.fact dd { margin: 0; color: var(--color-text); font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
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
.lane-outcome {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
}
.lane-radiant { color: #4bb45f; background: rgba(75,180,95,.12); border: 1px solid rgba(75,180,95,.3); }
.lane-dire    { color: #c83c3c; background: rgba(200,60,60,.12); border: 1px solid rgba(200,60,60,.3); }
.lane-neutral { color: var(--color-muted, #7a8799); background: var(--color-border, #2e3542); border: 1px solid transparent; }

.lane-chart { margin-bottom: 1rem; }

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
.role-badge {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 0.58rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.15rem 0.35rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(52,191,255,.15);
  color: #34bfff;
  border: 1px solid rgba(52,191,255,.3);
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
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-border, #2e3542);
}
.hero-line-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  object-fit: cover;
  background: var(--color-border, #2e3542);
}
.top-hero-name,
.match-hero-name {
  font-size: 0.78rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
