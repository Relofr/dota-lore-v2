<script setup>
import { computed } from 'vue'
import HeroIcon from './HeroIcon.vue'
import RankMedal from '@/components/RankMedal.vue'

const props = defineProps({
  // A ScoutView player: { accountId, name, thisMatch } where thisMatch is the raw Stratz match player.
  player: { type: Object, required: true },
})

const m = computed(() => props.player.thisMatch ?? {})
const account = computed(() => m.value.steamAccount ?? {})
const name = computed(() => (props.player.accountId ? account.value.name || props.player.name : 'Anonymous'))
</script>

<template>
  <div class="matchup-card">
    <HeroIcon :hero="m.hero" wide class="hero-img" />

    <div class="card-stats">
      <div class="kda" :aria-label="`${m.kills} kills, ${m.deaths} deaths, ${m.assists} assists`">
        <span>{{ m.kills ?? '—' }}</span><i>/</i><span>{{ m.deaths ?? '—' }}</span><i>/</i><span>{{ m.assists ?? '—' }}</span>
      </div>
      <div class="networth" title="Net worth">
        <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true">
          <ellipse cx="6" cy="7.5" rx="5" ry="3.2" fill="#b8860b" />
          <ellipse cx="6" cy="6.3" rx="5" ry="3.2" fill="#f0c43c" />
          <ellipse cx="10.5" cy="5.2" rx="4.5" ry="2.9" fill="#b8860b" />
          <ellipse cx="10.5" cy="4.1" rx="4.5" ry="2.9" fill="#f5d36a" />
        </svg>
        {{ m.networth != null ? m.networth.toLocaleString() : '—' }}
      </div>
    </div>

    <div class="card-player">
      <div class="player-name" :title="name">{{ name }}</div>
      <RankMedal
        v-if="account.seasonRank"
        :rank="account.seasonRank"
        :leaderboard-rank="account.seasonLeaderboardRank"
        class="card-medal"
      />
      <span v-else class="card-medal" />
    </div>
  </div>
</template>

<style scoped>
.matchup-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));
}

.hero-img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; }

.card-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 0.4rem 0.75rem;
}
.kda {
  display: flex;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
.kda i { font-style: normal; font-weight: 400; color: var(--color-muted, #7a8799); }
.networth {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #e8c547;
  font-variant-numeric: tabular-nums;
}

.card-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding: 0.55rem 0.4rem 0.6rem;
  border-top: 1px solid var(--color-border, #2e3542);
  background: rgba(255,255,255,.02);
}
.player-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-text);
}
.card-medal { display: block; width: 34px; height: 34px; }
</style>
