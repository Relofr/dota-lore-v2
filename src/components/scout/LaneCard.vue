<script setup>
import { computed } from 'vue'
import HeroIcon from './HeroIcon.vue'
import LaneOutcome from './LaneOutcome.vue'

const props = defineProps({
  // A laneGroups entry: { key, label, short, outcome, radiant, dire }.
  group: { type: Object, required: true },
  // Whether this lane's section is the one in view.
  active: { type: Boolean, default: false },
  // compareRow entries (laneBreakdown's or laneTotals') for whichever point in the game is being shown.
  rows: { type: Array, default: () => [] },
  // Heading over the stats, e.g. "At 10:00" or "End of Game".
  statsLabel: { type: String, required: true },
})
defineEmits(['select'])

// A few of the rows, enough to size up the lane from the sidebar.
const STAT_KEYS = ['networth', 'lastHits', 'deaths']
const stats = computed(() => STAT_KEYS
  .map(key => props.rows.find(r => r.key === key))
  .filter(Boolean))

// Same split as the lane breakdown: the longer bright segment marks the side that did better.
function share(row) {
  const sum = row.r + row.d
  if (sum <= 0) return 50
  return ((row.lowerIsBetter ? row.d : row.r) / sum) * 100
}
</script>

<template>
  <button
    class="lane-card"
    :class="{ active }"
    type="button"
    :aria-current="active ? 'location' : null"
    :title="`Jump to ${group.label}`"
    @click="$emit('select', group.key)"
  >
    <span class="card-head">
      <span class="card-title">{{ group.short ?? group.label }}</span>
      <LaneOutcome v-if="group.outcome" :outcome="group.outcome" />
    </span>

    <span class="card-heroes" :class="{ solo: group.radiant.length <= 1 && group.dire.length <= 1 }">
      <span class="heroes heroes-r">
        <HeroIcon v-for="p in group.radiant" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
      <em>vs</em>
      <span class="heroes heroes-d">
        <HeroIcon v-for="p in group.dire" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
    </span>

    <span v-if="stats.length" class="card-stats">
      <span class="stats-label">{{ statsLabel }}</span>
      <span v-for="row in stats" :key="row.key" class="stat">
        <span class="stat-label">{{ row.label }}</span>
        <span class="stat-value stat-r" :class="{ ahead: row.better === 'radiant' }">{{ row.rText }}</span>
        <span class="bar" aria-hidden="true">
          <span class="bar-r" :class="{ dim: row.better === 'dire' }" :style="{ width: `${share(row)}%` }" />
          <span class="bar-d" :class="{ dim: row.better === 'radiant' }" />
        </span>
        <span class="stat-value" :class="{ ahead: row.better === 'dire' }">{{ row.dText }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.lane-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.5rem 0.7rem;
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
.lane-card.active { border-color: rgba(52,191,255,.55); background: rgba(52,191,255,.07); box-shadow: inset 3px 0 0 #34bfff; }

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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
/* Each side's heroes grouped on its team colour. */
.heroes {
  display: flex;
  gap: 0.25rem;
  flex: 1;
  justify-content: space-evenly;
  padding: 0.2rem;
  border-radius: 6px;
}
/* A 1v1 lane (mid) hugs its single heroes instead of stretching, so the pair sits centred. */
.solo .heroes { flex: none; }
.heroes-r { background: rgba(75,180,95,.16); box-shadow: inset 0 0 0 1px rgba(75,180,95,.3); }
.heroes-d { background: rgba(200,60,60,.16); box-shadow: inset 0 0 0 1px rgba(200,60,60,.3); }
.card-hero { width: 30px; height: 30px; border-radius: 4px; }

/* Radiant value, a split bar, Dire value: the same reading as the lane breakdown. */
.card-stats { display: flex; flex-direction: column; gap: 0.15rem; }
.stats-label {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
}
.stat {
  display: grid;
  grid-template-columns: minmax(3.8rem, 1fr) 2.6rem minmax(2rem, 1.2fr) 2.6rem;
  align-items: center;
  column-gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}
.stat-label { font-size: 0.7rem; color: var(--color-muted, #7a8799); }
.stat-value { font-size: 0.74rem; font-weight: 600; color: var(--color-muted, #7a8799); }
.stat-r { text-align: right; }
.stat-value.ahead { color: var(--color-text); font-weight: 700; }

.bar { display: flex; gap: 2px; height: 5px; }
.bar-r, .bar-d { height: 100%; border-radius: 3px; }
.bar-r { background: #45a957; }
.bar-d { flex: 1; background: #c83c3c; }
.bar .dim { opacity: 0.35; }
</style>
