<script setup>
import { computed } from 'vue'
import HeroIcon from './HeroIcon.vue'
import LaneOutcome from './LaneOutcome.vue'

const props = defineProps({
  // A laneGroups entry: { key, label, outcome, radiant, dire }.
  group: { type: Object, required: true },
  // compareRow entries from laneBreakdown, at whichever point in the game is being shown.
  stats: { type: Array, default: () => [] },
  statsLabel: { type: String, required: true },
})
defineEmits(['select'])

const STATS = [
  { key: 'networth', label: 'Net worth' },
  { key: 'lastHits', label: 'Last hits' },
  { key: 'xp', label: 'Experience' },
  { key: 'heroDamage', label: 'Hero damage' },
  { key: 'deaths', label: 'Deaths' },
]

const rows = computed(() => STATS.map(s => props.stats.find(r => r.key === s.key)).filter(Boolean))

// Same split as the lane breakdown: the longer bright segment marks the side that did better.
function share(row) {
  const sum = row.r + row.d
  if (sum <= 0) return 50
  return ((row.lowerIsBetter ? row.d : row.r) / sum) * 100
}
</script>

<template>
  <button class="lane-card" type="button" @click="$emit('select', group.key)">
    <span class="card-head">
      <span class="card-title">{{ group.label }}</span>
      <LaneOutcome v-if="group.outcome" :outcome="group.outcome" />
    </span>

    <span class="card-heroes">
      <span class="heroes heroes-r">
        <HeroIcon v-for="p in group.radiant" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
      <em>vs</em>
      <span class="heroes heroes-d">
        <HeroIcon v-for="p in group.dire" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
    </span>

    <span v-if="rows.length" class="card-stats">
      <span class="stats-label">{{ statsLabel }}</span>
      <span v-for="row in rows" :key="row.key" class="stat">
        <span class="stat-label">{{ row.label }}</span>
        <span class="stat-value stat-r" :class="{ ahead: row.better === 'radiant' }">{{ row.rText }}</span>
        <span class="bar" aria-hidden="true">
          <span class="bar-r" :class="{ dim: row.better === 'dire' }" :style="{ width: `${share(row)}%` }" />
          <span class="bar-d" :class="{ dim: row.better === 'radiant' }" />
        </span>
        <span class="stat-value stat-d" :class="{ ahead: row.better === 'dire' }">{{ row.dText }}</span>
      </span>
    </span>

    <span class="card-link">View lane <span aria-hidden="true">↓</span></span>
  </button>
</template>

<style scoped>
.lane-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.75rem 0.85rem;
  text-align: left;
  font: inherit;
  color: var(--color-text);
  background: rgba(255,255,255,.02);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.lane-card:hover { border-color: rgba(52,191,255,.4); background: rgba(52,191,255,.05); }
.lane-card:focus-visible { outline: 2px solid #34bfff; outline-offset: 2px; }

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}
.card-title { font-size: 0.85rem; font-weight: 700; }

.card-heroes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.card-heroes em {
  font-style: normal;
  font-size: 0.68rem;
  color: var(--color-muted, #7a8799);
}
.heroes { display: flex; gap: 0.25rem; flex: 1; }
.heroes-r { justify-content: flex-end; }
.card-hero { width: 26px; height: 26px; border-radius: 3px; }

.card-stats { display: flex; flex-direction: column; gap: 0.3rem; }
.stats-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
}
.stat {
  display: grid;
  grid-template-columns: minmax(4.2rem, 1fr) 2.8rem minmax(2rem, 1.2fr) 2.8rem;
  align-items: center;
  column-gap: 0.45rem;
  font-variant-numeric: tabular-nums;
}
.stat-label { font-size: 0.7rem; color: var(--color-muted, #7a8799); }
.stat-value { font-size: 0.74rem; font-weight: 600; color: var(--color-muted, #7a8799); }
.stat-r { text-align: right; }
.stat-value.ahead { color: #fff; font-weight: 700; }

.bar { display: flex; gap: 2px; height: 5px; }
.bar-r, .bar-d { height: 100%; border-radius: 3px; }
.bar-r { background: #45a957; }
.bar-d { flex: 1; background: #c83c3c; }
.bar .dim { opacity: 0.35; }

.card-link {
  margin-top: auto;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-muted, #7a8799);
}
.lane-card:hover .card-link { color: #34bfff; }
</style>
