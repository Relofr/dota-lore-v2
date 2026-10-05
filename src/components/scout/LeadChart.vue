<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'
import { compact, signed, formatTime } from '@/utils/matchAnalysis.js'
import HeroIcon from './HeroIcon.vue'

const props = defineProps({
  values: { type: Array, required: true },
  extras: { type: Array, default: () => [] },
  label: { type: String, required: true },
  height: { type: Number, default: 150 },
  // Grow to fill the parent's height (never below `height`), e.g. to match a neighbouring panel.
  fill: { type: Boolean, default: false },
  // Seconds between points; the x-axis is still labelled in whole minutes.
  step: { type: Number, default: 60 },
  // [{ key, hero, isRadiant, values }] — per-hero values listed in the tooltip under the lead.
  heroes: { type: Array, default: () => [] },
})

const heroSides = computed(() => [
  { key: 'radiant', label: 'Radiant', list: props.heroes.filter(h => h.isRadiant) },
  { key: 'dire', label: 'Dire', list: props.heroes.filter(h => !h.isRadiant) },
].filter(s => s.list.length))

// Validated pair (dark surface #1a1f2b): CVD ΔE 8.3, every mark also carries a text label.
const RADIANT = '#45a957'
const DIRE = '#c83c3c'
const PAD = { l: 40, r: 12, t: 10, b: 22 }

const uid = useId()
const root = ref(null)
const body = ref(null)
const bodyHeight = ref(0)
const width = ref(560)
const hover = ref(null)
let observer
let bodyObserver

onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(240, entry.contentRect.width) })
  observer.observe(root.value)
  if (props.fill) {
    bodyObserver = new ResizeObserver(([entry]) => { bodyHeight.value = entry.contentRect.height })
    bodyObserver.observe(body.value)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  bodyObserver?.disconnect()
})

const h = computed(() => (props.fill ? Math.max(props.height, Math.floor(bodyHeight.value)) : props.height))

const n = computed(() => props.values.length)
const plotW = computed(() => width.value - PAD.l - PAD.r)
const plotH = computed(() => h.value - PAD.t - PAD.b)

function niceStep(range, count) {
  const raw = range / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

const domain = computed(() => {
  const hi = Math.max(0, ...props.values)
  const lo = Math.min(0, ...props.values)
  const step = niceStep(Math.max(hi - lo, 200), 4)
  const max = Math.max(step, Math.ceil(hi / step) * step)
  const min = Math.min(-step, Math.floor(lo / step) * step)
  const ticks = []
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v)
  return { min, max, ticks }
})

const x = i => PAD.l + (n.value <= 1 ? 0 : (i / (n.value - 1)) * plotW.value)
const y = v => PAD.t + ((domain.value.max - v) / (domain.value.max - domain.value.min)) * plotH.value
const zeroY = computed(() => y(0))

const linePath = computed(() => props.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(''))
const areaPath = computed(() => `${linePath.value}L${x(n.value - 1).toFixed(1)},${zeroY.value.toFixed(1)}L${x(0).toFixed(1)},${zeroY.value.toFixed(1)}Z`)

const perMinute = computed(() => 60 / props.step)

// Tick positions are point indexes; labels are minutes.
const xTicks = computed(() => {
  const lastMinute = Math.floor(((n.value - 1) * props.step) / 60)
  const every = lastMinute <= 12 ? (plotW.value < 360 ? 2 : 1) : lastMinute <= 30 ? 5 : 10
  const ticks = []
  for (let m = 0; m <= lastMinute; m += every) ticks.push({ i: m * perMinute.value, label: m })
  return ticks
})

function sideOf(v) {
  return v > 0 ? 'Radiant ahead' : v < 0 ? 'Dire ahead' : 'Even'
}

function sideShort(v) {
  return v > 0 ? 'Radiant' : v < 0 ? 'Dire' : 'even'
}

function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * width.value
  hover.value = Math.max(0, Math.min(n.value - 1, Math.round(((px - PAD.l) / plotW.value) * (n.value - 1))))
}

function onKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const start = hover.value ?? (e.key === 'ArrowLeft' ? n.value : -1)
  // Shift jumps a whole minute, which matters when points are seconds apart.
  const by = e.shiftKey ? Math.max(1, perMinute.value) : 1
  hover.value = Math.max(0, Math.min(n.value - 1, start + (e.key === 'ArrowRight' ? by : -by)))
}

const tooltipStyle = computed(() => {
  if (hover.value == null) return {}
  const px = x(hover.value)
  const flip = px > width.value - (props.heroes.length ? 260 : 170)
  return flip ? { right: `${width.value - px + 10}px` } : { left: `${px + 10}px` }
})

const summary = computed(() => {
  const end = props.values.at(-1) ?? 0
  return `${props.label}: ${signed(end)} at ${formatTime((n.value - 1) * props.step)} (${sideOf(end)})`
})
</script>

<template>
  <div ref="root" class="lead-chart" :class="{ fill }">
    <div class="chart-head">
      <span class="chart-title">{{ label }}</span>
      <span class="legend">
        <span class="key"><i :style="{ background: RADIANT }" />Radiant</span>
        <span class="key"><i :style="{ background: DIRE }" />Dire</span>
      </span>
    </div>
    <div ref="body" class="chart-body" :style="fill ? { minHeight: `${height}px` } : null">
      <svg
        :width="width"
        :height="h"
        role="img"
        :aria-label="summary"
        tabindex="0"
        class="chart-svg"
        @pointermove="onMove"
        @pointerleave="hover = null"
        @keydown="onKey"
        @blur="hover = null"
      >
        <defs>
          <clipPath :id="`${uid}-above`"><rect :x="0" :y="0" :width="width" :height="zeroY" /></clipPath>
          <clipPath :id="`${uid}-below`"><rect :x="0" :y="zeroY" :width="width" :height="h" /></clipPath>
        </defs>

        <g class="grid">
          <line v-for="t in domain.ticks" :key="t" :x1="PAD.l" :x2="width - PAD.r" :y1="y(t)" :y2="y(t)" :class="{ zero: t === 0 }" />
        </g>
        <g class="y-ticks">
          <text v-for="t in domain.ticks" :key="t" :x="PAD.l - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ compact(Math.abs(t)) }}</text>
        </g>
        <g class="x-ticks">
          <text v-for="t in xTicks" :key="t.i" :x="x(t.i)" :y="h - 6" text-anchor="middle">{{ t.label }}</text>
        </g>

        <path :d="areaPath" :fill="RADIANT" fill-opacity="0.12" :clip-path="`url(#${uid}-above)`" />
        <path :d="areaPath" :fill="DIRE" fill-opacity="0.12" :clip-path="`url(#${uid}-below)`" />
        <path :d="linePath" fill="none" :stroke="RADIANT" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :clip-path="`url(#${uid}-above)`" />
        <path :d="linePath" fill="none" :stroke="DIRE" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :clip-path="`url(#${uid}-below)`" />

        <g v-if="hover != null">
          <line class="crosshair" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="h - PAD.b" />
          <circle
            :cx="x(hover)"
            :cy="y(values[hover])"
            r="4.5"
            :fill="values[hover] >= 0 ? RADIANT : DIRE"
            class="hover-dot"
          />
        </g>
      </svg>

      <div v-if="hover != null" class="tooltip" :style="tooltipStyle">
        <div class="tt-time">{{ formatTime(hover * step) }}</div>
        <div class="tt-row">
          <i :style="{ background: values[hover] >= 0 ? RADIANT : DIRE }" />
          <strong>{{ compact(Math.abs(values[hover])) }}</strong>
          <span>{{ label }} · {{ sideShort(values[hover]) }}</span>
        </div>
        <div v-for="ex in extras" :key="ex.label" class="tt-row">
          <i :style="{ background: (ex.values[hover] ?? 0) >= 0 ? RADIANT : DIRE }" />
          <strong>{{ compact(Math.abs(ex.values[hover] ?? 0)) }}</strong>
          <span>{{ ex.label }} · {{ sideShort(ex.values[hover] ?? 0) }}</span>
        </div>
        <div v-for="side in heroSides" :key="side.key" class="tt-heroes">
          <div class="tt-side">{{ side.label }}</div>
          <div v-for="h in side.list" :key="h.key" class="tt-hero">
            <HeroIcon :hero="h.hero" class="tt-hero-icon" />
            <strong>{{ compact(h.values[hover] ?? 0) }}</strong>
          </div>
        </div>
      </div>
    </div>
    <div class="x-label">Minute</div>
  </div>
</template>

<style scoped>
.lead-chart { position: relative; min-width: 0; }

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
}
.chart-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text);
}
.legend { display: flex; gap: 0.75rem; }
.key {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.66rem;
  color: var(--color-muted, #7a8799);
}
/* Same square as the lane breakdown's key. */
.key i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.tt-row i {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
}

.chart-body { position: relative; }
/* In fill mode the body takes the spare height and the SVG is sized from it, so it can't push back. */
.lead-chart.fill { display: flex; flex-direction: column; height: 100%; }
.lead-chart.fill .chart-body { flex: 1; }
.lead-chart.fill .chart-svg { position: absolute; top: 0; left: 0; }
.chart-svg { display: block; max-width: 100%; outline: none; touch-action: pan-y; }
.chart-svg:focus-visible { outline: 1px solid var(--color-accent, #34bfff); outline-offset: 2px; border-radius: 4px; }

.grid line { stroke: #2a3140; stroke-width: 1; shape-rendering: crispEdges; }
.grid line.zero { stroke: #4a5366; }
.y-ticks text, .x-ticks text {
  font-size: 10px;
  fill: var(--color-muted, #7a8799);
  font-variant-numeric: tabular-nums;
}
.crosshair { stroke: #7a8799; stroke-width: 1; shape-rendering: crispEdges; }
.hover-dot { stroke: var(--color-surface, #1a1f2b); stroke-width: 2; }

.x-label {
  text-align: center;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted, #7a8799);
}

.tooltip {
  position: absolute;
  top: 4px;
  pointer-events: none;
  background: #252b36;
  border: 1px solid #2e3542;
  border-radius: 6px;
  padding: 0.4rem 0.55rem;
  min-width: 150px;
  z-index: 5;
  font-variant-numeric: tabular-nums;
}
.tt-time {
  font-size: 0.66rem;
  color: var(--color-muted, #7a8799);
  margin-bottom: 0.2rem;
}
.tt-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  white-space: nowrap;
}
.tt-heroes {
  margin-top: 0.35rem;
  padding-top: 0.3rem;
  border-top: 1px solid #2e3542;
}
.tt-side {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted, #7a8799);
  margin-bottom: 0.15rem;
}
.tt-hero {
  display: grid;
  grid-template-columns: 20px auto;
  align-items: center;
  column-gap: 0.4rem;
  font-size: 0.72rem;
  padding: 0.08rem 0;
  white-space: nowrap;
}
.tt-hero img {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  object-fit: cover;
}
.tt-hero strong { color: var(--color-text); font-weight: 700; text-align: right; }
.tt-row strong { color: var(--color-text); font-weight: 700; min-width: 3.2rem; }
.tt-row span { color: var(--color-muted, #7a8799); }
</style>
