<script setup>
defineProps({
  breakdown: { type: Object, required: true },
  minute: { type: Number, required: true },
})

const NUMBER_PATTERN = /([+−]?\d+(?:[.:]\d+)?k?)/

function segments(text) {
  return text.split(NUMBER_PATTERN).filter(Boolean).map(part => ({ text: part, num: NUMBER_PATTERN.test(part) }))
}

// Radiant's share of the advantage, so the longer bright segment always marks the side that did better;
// for deaths and gold given away that means the side with less. Both zero splits evenly.
function share(row) {
  const sum = row.r + row.d
  if (sum <= 0) return 50
  return ((row.lowerIsBetter ? row.d : row.r) / sum) * 100
}
</script>

<template>
  <div class="breakdown">
    <div class="section-label">Lane breakdown · 0–{{ minute }} min</div>

    <p class="headline">
      <template v-for="(seg, i) in segments(breakdown.headline)" :key="i">
        <strong v-if="seg.num">{{ seg.text }}</strong>
        <template v-else>{{ seg.text }}</template>
      </template>
    </p>

    <div class="breakdown-body">
    <div class="breakdown-main">
    <div class="compare" role="table" :aria-label="`Lane comparison at ${minute}:00`">
      <div class="compare-row compare-head" role="row">
        <span role="columnheader" class="side side-r"><i class="key key-r" />Radiant</span>
        <span role="columnheader" aria-hidden="true" />
        <span role="columnheader" class="side side-d">Dire<i class="key key-d" /></span>
      </div>

      <div v-for="row in breakdown.rows" :key="row.key" class="compare-row" role="row">
        <span role="rowheader" class="metric">{{ row.label }}</span>
        <span role="cell" class="value value-r">
          <span :class="{ ahead: row.better === 'radiant' }">{{ row.rText }}</span>
          <small v-if="row.rSub">{{ row.rSub }}</small>
        </span>
        <span class="bar" aria-hidden="true">
          <span class="bar-r" :class="{ dim: row.better === 'dire' }" :style="{ width: `${share(row)}%` }" />
          <span class="bar-d" :class="{ dim: row.better === 'radiant' }" />
        </span>
        <span role="cell" class="value value-d">
          <span :class="{ ahead: row.better === 'dire' }">{{ row.dText }}</span>
          <small v-if="row.dSub">{{ row.dSub }}</small>
        </span>
      </div>
    </div>

    <ul v-if="breakdown.rotations.length" class="notes">
      <li v-for="rot in breakdown.rotations" :key="rot.victims">
        <span class="note-label">Ganked {{ rot.victims }}</span>
        {{ rot.killers.map(k => k.count > 1 ? `${k.name} ×${k.count}` : k.name).join(', ') }}
      </li>
    </ul>
    </div>

    <div v-if="breakdown.core" class="core">
      <div class="core-title">
        Core matchup
        <span class="core-heroes">{{ breakdown.core.radiant }} <em>vs</em> {{ breakdown.core.dire }}</span>
      </div>
      <div class="compare">
        <div v-for="row in breakdown.core.rows" :key="row.key" class="compare-row" role="row">
          <span role="rowheader" class="metric">{{ row.label }}</span>
          <span role="cell" class="value value-r"><span :class="{ ahead: row.better === 'radiant' }">{{ row.rText }}</span></span>
          <span class="bar" aria-hidden="true">
            <span class="bar-r" :class="{ dim: row.better === 'dire' }" :style="{ width: `${share(row)}%` }" />
            <span class="bar-d" :class="{ dim: row.better === 'radiant' }" />
          </span>
          <span role="cell" class="value value-d"><span :class="{ ahead: row.better === 'dire' }">{{ row.dText }}</span></span>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.breakdown {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  min-width: 0;
  container-type: inline-size;
}
.breakdown-main { min-width: 0; }

/* Laid out full-width above the player cards, the core matchup moves beside the table. */
@container (min-width: 760px) {
  .breakdown-body {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 2rem;
    align-items: start;
  }
  .breakdown-body .core {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
    padding-left: 2rem;
    border-left: 1px solid var(--color-border, #2e3542);
  }
}

.section-label {
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text);
  border-left: 2px solid var(--color-accent, #34bfff);
  padding-left: 0.45rem;
  line-height: 1.1;
  margin-bottom: 0.6rem;
}

.headline {
  margin: 0 0 0.85rem;
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--color-muted, #7a8799);
}
.headline strong { color: #c9c9c9; font-weight: 700; }

.compare { display: flex; flex-direction: column; }
.compare-row {
  display: grid;
  grid-template-columns: minmax(5.5rem, 1.1fr) 3.4rem minmax(2.5rem, 1.6fr) 3.4rem;
  align-items: center;
  column-gap: 0.55rem;
  padding: 0.32rem 0;
  font-variant-numeric: tabular-nums;
}
.compare-head { padding-bottom: 0.15rem; }

.metric {
  font-size: 0.73rem;
  color: var(--color-muted, #7a8799);
}
.side {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
}
.side-r { grid-column: 1 / 3; justify-content: flex-end; }
.side { white-space: nowrap; }
.key {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.key-r { background: #45a957; }
.key-d { background: #c83c3c; }

.value {
  display: flex;
  flex-direction: column;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted, #7a8799);
  line-height: 1.2;
  min-width: 0;
}
.value-r { align-items: flex-end; text-align: right; }
.value-d { align-items: flex-start; }
.value .ahead { color: #fff; font-weight: 700; }
.value small {
  font-size: 0.6rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-muted, #7a8799);
  white-space: pre-line;
}

.bar {
  display: flex;
  gap: 2px;
  height: 6px;
}
.bar-r,
.bar-d {
  height: 100%;
  border-radius: 3px;
  transition: width 0.25s;
}
.bar-r { background: #45a957; }
.bar-d { flex: 1; background: #c83c3c; }
.bar .dim { opacity: 0.35; }

.notes {
  list-style: none;
  margin: 0.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.73rem;
  color: #c9c9c9;
}
.note-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
  margin-right: 0.35rem;
}

.core {
  margin-top: 0.85rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--color-border, #2e3542);
}
.core-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
  margin-bottom: 0.2rem;
}
.core-heroes {
  font-size: 0.77rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-text);
}
.core-heroes em { font-style: normal; color: var(--color-muted, #7a8799); }

@media (max-width: 520px) {
  .compare-row { grid-template-columns: minmax(0, 1fr) 3.8rem minmax(2.5rem, 4.5rem) 3.8rem; column-gap: 0.45rem; }
}
</style>
