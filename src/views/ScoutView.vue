<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  fetchPlayersData,
  fetchMatchPlayers,
  fetchPlayerMatches,
  fetchRankedPeriodPage,
  PERIOD_PAGE_SIZE,
} from '@/services/stratzApi.js'
import StratzIcon from '@/components/StratzIcon.vue'
import RankMedal from '@/components/RankMedal.vue'

const HERO_ICON = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons'
const OPENDOTA_ICON = 'https://www.opendota.com/assets/images/icons/icon-512x512.png'
const DOTABUFF_ICON = 'https://www.dotabuff.com/assets/favicon-retina-377ae687bcef452311a9c4303e2efcb1a3e9dceeb924084856e960256862b843.png'
// OpenDota's live tracker misses most public games, so auto-detect is off until there's a reliable source.
const SHOW_STEAM_SEARCH = false
const STORAGE_KEY = 'scout_steam_id'

const POSITION_LABELS = {
  POSITION_1: 'Carry',
  POSITION_2: 'Mid',
  POSITION_3: 'Offlane',
  POSITION_4: 'Soft Support',
  POSITION_5: 'Hard Support',
}

const steamIdInput = ref('')
const matchIdInput = ref('')
const loading = ref(false)
const error = ref(null)
const match = ref(null)
const playerData = ref({})
const dataLoading = ref({})
const periodLoading = ref({})
const moreLoading = ref({})
const noMoreMatches = ref({})

onMounted(() => {
  steamIdInput.value = localStorage.getItem(STORAGE_KEY) ?? ''
})

const radiantPlayers = computed(() => match.value?.players?.filter(p => p.isRadiant) ?? [])
const direPlayers = computed(() => match.value?.players?.filter(p => !p.isRadiant) ?? [])

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

const LANE_NAMES = {
  SAFE_LANE: 'Safe Lane',
  MID_LANE: 'Mid',
  OFF_LANE: 'Off Lane',
  JUNGLE: 'Jungle',
  ROAMING: 'Roaming',
}

// Radiant's safe lane is bottom and Dire's is top; the off lanes are the reverse.
function mapLane(lane, isRadiant) {
  if (lane === 'MID_LANE') return 'mid'
  if (lane === 'SAFE_LANE') return isRadiant ? 'bottom' : 'top'
  if (lane === 'OFF_LANE') return isRadiant ? 'top' : 'bottom'
  return null
}

function laneResult(p) {
  const s = p.thisMatch
  const mapLaneKey = s && mapLane(s.lane, p.isRadiant)
  const outcome = mapLaneKey && match.value?.laneOutcomes?.[mapLaneKey]
  if (!outcome) return null
  if (outcome === 'TIE') return { label: 'Lane Tied', tone: 'even' }
  const radiantWon = outcome.startsWith('RADIANT')
  const stomp = outcome.endsWith('STOMP')
  const won = radiantWon === p.isRadiant
  return {
    label: won ? (stomp ? 'Lane Won · Stomp' : 'Lane Won') : (stomp ? 'Lane Lost · Stomped' : 'Lane Lost'),
    tone: won ? 'win' : 'loss',
  }
}

function compact(n) {
  if (n == null) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
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

function formatDuration(s) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
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

function parseSteamId(rawId) {
  const n = BigInt(rawId.trim())
  return n > 76561197960265728n ? Number(n - 76561197960265728n) : Number(n)
}

function buildMatch(found) {
  match.value = {
    matchId: found.match_id,
    gameTime: found.game_time,
    players: (found.players ?? []).map(p => ({
      accountId: p.account_id,
      heroId: p.hero_id,
      isRadiant: p.team === 0,
      name: p.name ?? `Player ${p.account_id}`,
    }))
  }
  loadAllPlayerData()
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
  error.value = null
}

async function fetchLiveGames() {
  const res = await fetch('https://api.opendota.com/api/live')
  if (!res.ok) throw new Error(`OpenDota returned ${res.status}`)
  return res.json()
}

async function findGame() {
  const rawId = steamIdInput.value.trim()
  if (!rawId) return
  localStorage.setItem(STORAGE_KEY, rawId)
  const accountId = parseSteamId(rawId)
  loading.value = true
  resetState()
  try {
    const liveMatches = await fetchLiveGames()
    const found = liveMatches.find(m => m.players?.some(p => p.account_id === accountId))
    if (!found) {
      error.value = `Your game wasn't found in OpenDota's live tracker (${liveMatches.length} games tracked). Enter your match ID below — get it from the Dota 2 console with: dota_match_id`
      return
    }
    buildMatch(found)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
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
      matchId: data.id,
      gameTime: null,
      didRadiantWin: data.didRadiantWin,
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
      }))
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
      <template v-if="SHOW_STEAM_SEARCH">
        <div class="search-row">
          <input
            v-model="steamIdInput"
            class="match-input"
            placeholder="Steam ID or Steam64..."
            @keydown.enter="findGame"
          />
          <button class="load-btn" :disabled="loading" @click="findGame">
            {{ loading ? 'Searching…' : 'Find My Game' }}
          </button>
        </div>
        <div class="divider-row"><span class="divider-text">or enter match ID manually</span></div>
      </template>
      <div class="search-row">
        <input
          v-model="matchIdInput"
          class="match-input"
          placeholder="Match ID"
          @keydown.enter="loadByMatchId"
        />
        <button class="load-btn" :class="{ secondary: SHOW_STEAM_SEARCH }" :disabled="loading" @click="loadByMatchId">
          {{ loading && !SHOW_STEAM_SEARCH ? 'Loading…' : 'Load Match' }}
        </button>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </header>

    <div v-if="match" class="match-info">
      <p class="match-summary">
        Viewing match <strong class="match-id">{{ match.matchId }}</strong>
        <template v-if="match.gameTime != null"> at {{ formatDuration(match.gameTime) }}</template>
      </p>
      <p class="match-note">
        All player stats are from ranked matches only. Win rates and top heroes cover the last 3 months.
      </p>
    </div>

    <div v-if="match" class="teams">
      <div v-for="(players, ti) in [radiantPlayers, direPlayers]" :key="ti" class="team">
        <div class="team-heading">
          <div class="team-label" :class="ti === 0 ? 'radiant-label' : 'dire-label'">
            {{ ti === 0 ? 'Radiant' : 'Dire' }}
          </div>
          <span
            v-if="match.didRadiantWin != null"
            class="team-result"
            :class="match.didRadiantWin === (ti === 0) ? 'win' : 'loss'"
          >{{ match.didRadiantWin === (ti === 0) ? 'Victory' : 'Defeat' }}</span>
        </div>
        <div class="player-list">
          <div v-for="p in players" :key="p.accountId" class="player-card">

            <!-- Player header -->
            <div class="player-header">
              <img v-if="playerAvatar(p)" :src="playerAvatar(p)" class="avatar" alt="" />
              <div v-else class="avatar avatar-empty" />
              <div class="player-info">
                <div class="name-row">
                  <RankMedal
                    v-if="playerData[p.accountId]?.steamAccount?.seasonRank"
                    :rank="playerData[p.accountId].steamAccount.seasonRank"
                    :leaderboard-rank="playerData[p.accountId].steamAccount.seasonLeaderboardRank"
                  />
                  <span class="player-name">{{ playerName(p) }}</span>
                  <template v-if="!dataLoading[p.accountId] && playerRoles(p.accountId).length">
                    <span class="name-divider" aria-hidden="true" />
                    <span
                      v-for="role in playerRoles(p.accountId)"
                      :key="role"
                      class="role-badge"
                    >{{ role }}</span>
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
                <a
                  :href="`https://stratz.com/players/${p.accountId}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="profile-link"
                  title="Open Stratz profile"
                  aria-label="Open Stratz profile"
                >
                  <StratzIcon class="profile-logo" />
                </a>
                <a
                  :href="`https://www.opendota.com/players/${p.accountId}/overview`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="profile-link"
                  title="Open OpenDota profile"
                  aria-label="Open OpenDota profile"
                >
                  <img :src="OPENDOTA_ICON" class="profile-logo" alt="" />
                </a>
                <a
                  :href="`https://www.dotabuff.com/players/${p.accountId}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="profile-link"
                  title="Open Dotabuff profile"
                  aria-label="Open Dotabuff profile"
                >
                  <img :src="DOTABUFF_ICON" class="profile-logo" alt="" />
                </a>
              </div>
            </div>

            <div v-if="p.thisMatch" class="section this-match">
              <div class="section-label">This Match</div>
              <div class="this-match-main">
                <img
                  v-if="p.thisMatch.hero?.shortName"
                  :src="`${HERO_ICON}/${p.thisMatch.hero.shortName}.png`"
                  class="this-match-hero-icon"
                  alt=""
                />
                <div class="this-match-hero">
                  <span class="this-match-hero-name">{{ p.thisMatch.hero?.displayName ?? '—' }}</span>
                  <span class="this-match-sub">
                    Lvl {{ p.thisMatch.level ?? '—' }}
                    <template v-if="LANE_NAMES[p.thisMatch.lane]"> · {{ LANE_NAMES[p.thisMatch.lane] }}</template>
                  </span>
                </div>
              </div>
              <div class="this-match-stats">
                <div class="stat"><span class="stat-val">{{ p.thisMatch.kills }}/{{ p.thisMatch.deaths }}/{{ p.thisMatch.assists }}</span><span class="stat-label">KDA</span></div>
                <div class="stat"><span class="stat-val">{{ p.thisMatch.numLastHits }}/{{ p.thisMatch.numDenies }}</span><span class="stat-label">LH/DN</span></div>
                <div class="stat"><span class="stat-val">{{ p.thisMatch.goldPerMinute }}/{{ p.thisMatch.experiencePerMinute }}</span><span class="stat-label">GPM/XPM</span></div>
                <div class="stat"><span class="stat-val">{{ compact(p.thisMatch.networth) }}</span><span class="stat-label">Net Worth</span></div>
                <div class="stat"><span class="stat-val">{{ compact(p.thisMatch.heroDamage) }}</span><span class="stat-label">Hero Dmg</span></div>
              </div>
              <div v-if="laneResult(p)" class="lane-outcome" :class="`lane-${laneResult(p).tone}`">
                {{ laneResult(p).label }}
              </div>
            </div>

            <div v-if="dataLoading[p.accountId]" class="section-loading">Loading stats…</div>
            <div v-else-if="isPrivate(p)" class="private-profile">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z"/>
              </svg>
              Private Profile
            </div>
            <template v-else>

              <!-- Top 3 heroes (last 3 months) -->
              <div class="section">
                <div class="section-label">Top Ranked Heroes · 3 Months</div>
                <div v-if="!topHeroes(p.accountId).length" class="no-data">No data</div>
                <div
                  v-for="h in topHeroes(p.accountId)"
                  :key="h.heroId"
                  class="top-hero-row"
                >
                  <img
                    v-if="h.hero?.shortName"
                    :src="`${HERO_ICON}/${h.hero.shortName}.png`"
                    class="top-hero-icon"
                  />
                  <span class="top-hero-name">{{ h.hero?.displayName }}</span>
                  <span class="top-hero-stats">
                    <span :class="winRate(h) >= 50 ? 'wr-good' : 'wr-bad'">{{ winRate(h) }}%</span>
                    <span class="record">{{ h.winCount }}W · {{ h.matchCount - h.winCount }}L</span>
                  </span>
                </div>
              </div>

              <!-- Last 10 matches -->
              <div class="section">
                <div class="section-label">Recent Ranked Matches</div>
                <div v-if="!recentMatches(p.accountId).length" class="no-data">No data</div>
                <div
                  v-for="m in recentMatches(p.accountId)"
                  :key="m.id"
                  class="match-row"
                >
                  <img
                    v-if="m.players?.[0]?.hero?.shortName"
                    :src="`${HERO_ICON}/${m.players[0].hero.shortName}.png`"
                    class="match-hero-icon"
                  />
                  <span class="match-hero-name">{{ m.players?.[0]?.hero?.displayName ?? '—' }}</span>
                  <span class="match-result" :class="matchWon(m) ? 'win' : 'loss'">
                    {{ matchWon(m) ? 'W' : 'L' }}
                  </span>
                  <span class="match-kda">
                    {{ m.players?.[0]?.kills }}/{{ m.players?.[0]?.deaths }}/{{ m.players?.[0]?.assists }}
                  </span>
                  <span class="match-duration">{{ formatDuration(m.durationSeconds) }}</span>
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.scout-page {
  max-width: 1300px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.scout-header {
  text-align: center;
  margin-bottom: 2rem;
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

.load-btn.secondary {
  background: transparent;
  border: 1px solid var(--color-border, #2e3542);
  color: var(--color-text);
}
.load-btn.secondary:hover:not(:disabled) {
  border-color: var(--color-accent, #34bfff);
  color: var(--color-accent, #34bfff);
  opacity: 1;
}

.divider-row {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.75rem 0 0.5rem;
}
.divider-text {
  font-size: 0.75rem;
  color: var(--color-muted, #7a8799);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-msg {
  color: #ff6b6b;
  margin-top: 0.75rem;
  font-size: 0.88rem;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}

.match-info {
  text-align: center;
  margin-bottom: 1.5rem;
}
.match-summary {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}
.match-id {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.match-note {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  color: var(--color-muted, #7a8799);
}

.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 800px) { .teams { grid-template-columns: 1fr; } }

.team-heading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.team-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  display: inline-block;
}
.team-result {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.radiant-label { background: rgba(75,180,95,.15); color: #4bb45f; border: 1px solid rgba(75,180,95,.3); }
.dire-label    { background: rgba(200,60,60,.15);  color: #c83c3c; border: 1px solid rgba(200,60,60,.3); }

.player-list { display: flex; flex-direction: column; gap: 0.75rem; }

.player-card {
  background: var(--color-surface, #1a1f2b);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  padding: 0.75rem;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.5rem;
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
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.overall-wr {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
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
.profile-link:hover {
  opacity: 1;
  transform: scale(1.08);
}
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
.player-name {
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-loading {
  font-size: 0.75rem;
  color: var(--color-muted, #7a8799);
  padding: 0.4rem 0;
}

.this-match-main {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.this-match-hero-icon {
  width: 52px;
  height: 29px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-border, #2e3542);
}
.this-match-hero {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.this-match-hero-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.this-match-sub {
  font-size: 0.7rem;
  color: var(--color-muted, #7a8799);
}

.this-match-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.5rem;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 420px) {
  .this-match-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.stat-val {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}
.stat-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
}

.lane-outcome {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
}
.lane-win  { color: #4bb45f; background: rgba(75,180,95,.12); border: 1px solid rgba(75,180,95,.3); }
.lane-loss { color: #c83c3c; background: rgba(200,60,60,.12); border: 1px solid rgba(200,60,60,.3); }
.lane-even { color: var(--color-muted, #7a8799); background: var(--color-border, #2e3542); border: 1px solid transparent; }

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

.section { margin-top: 0.6rem; }
.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-muted, #7a8799);
  margin-bottom: 0.35rem;
}

.no-data {
  font-size: 0.75rem;
  color: var(--color-muted, #7a8799);
}

.top-hero-row,
.match-row {
  display: grid;
  align-items: center;
  column-gap: 0.6rem;
  padding: 0.18rem 0;
  font-variant-numeric: tabular-nums;
}
.top-hero-row { grid-template-columns: 22px minmax(0, 1fr) 2.6rem 5rem; }
.match-row    { grid-template-columns: 22px minmax(0, 1fr) 1rem 4.6rem 2.8rem 3.2rem; }

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

.top-hero-stats { display: contents; }
.wr-good, .wr-bad { font-size: 0.76rem; font-weight: 700; text-align: right; }
.wr-good { color: #4bb45f; }
.wr-bad  { color: #c83c3c; }
.record  { font-size: 0.72rem; color: var(--color-muted, #7a8799); text-align: right; }

.match-result { font-size: 0.74rem; font-weight: 700; text-align: center; }
.win  { color: #4bb45f; }
.loss { color: #c83c3c; }

.match-kda {
  font-size: 0.74rem;
  color: var(--color-text);
  text-align: center;
}
.match-duration,
.match-ago {
  font-size: 0.72rem;
  color: var(--color-muted, #7a8799);
  text-align: right;
}

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
  color: var(--color-accent, #34bfff);
  border-color: var(--color-accent, #34bfff);
}
.show-more-btn:disabled { opacity: 0.6; cursor: wait; }
</style>
