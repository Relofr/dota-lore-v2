<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'
import { compact, signed } from '@/utils/matchAnalysis.js'

const props = defineProps({
  values: { type: Array, required: true },
  extras: { type: Array, default: () => [] },
  label: { type: String, required: true },
  height: { type: Number, default: 150 },
})

// Validated pair (dark surface #1a1f2b): CVD ΔE 8.3, every mark also carries a text label.
const RADIANT = '#45a957'
const DIRE = '#c83c3c'
const PAD = { l: 40, r: 12, t: 10, b: 22 }

const uid = useId()
const root = ref(null)
const width = ref(560)
const hover = ref(null)
let observer

onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(240, entry.contentRect.width) })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const n = computed(() => props.values.length)
const plotW = computed(() => width.value - PAD.l - PAD.r)
const plotH = computed(() => props.height - PAD.t - PAD.b)

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

const xTicks = computed(() => {
  const last = n.value - 1
  const step = last <= 12 ? (plotW.value < 360 ? 2 : 1) : last <= 30 ? 5 : 10
  const ticks = []
  for (let m = 0; m <= last; m += step) ticks.push(m)
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
  hover.value = Math.max(0, Math.min(n.value - 1, start + (e.key === 'ArrowRight' ? 1 : -1)))
}

const tooltipStyle = computed(() => {
  if (hover.value == null) return {}
  const px = x(hover.value)
  const flip = px > width.value - 170
  return flip ? { right: `${width.value - px + 10}px` } : { left: `${px + 10}px` }
})

const summary = computed(() => {
  const end = props.values.at(-1) ?? 0
  return `${props.label}: ${signed(end)} at ${n.value - 1}:00 (${sideOf(end)})`
})
</script>

<template>
  <div ref="root" class="lead-chart">
    <div class="chart-head">
      <span class="chart-title">{{ label }}</span>
      <span class="legend">
        <span class="key"><i :style="{ background: RADIANT }" />Radiant ahead</span>
        <span class="key"><i :style="{ background: DIRE }" />Dire ahead</span>
      </span>
    </div>
    <div class="chart-body">
      <svg
        :width="width"
        :height="height"
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
          <clipPath :id="`${uid}-below`"><rect :x="0" :y="zeroY" :width="width" :height="height" /></clipPath>
        </defs>

        <g class="grid">
          <line v-for="t in domain.ticks" :key="t" :x1="PAD.l" :x2="width - PAD.r" :y1="y(t)" :y2="y(t)" :class="{ zero: t === 0 }" />
        </g>
        <g class="y-ticks">
          <text v-for="t in domain.ticks" :key="t" :x="PAD.l - 6" :y="y(t)" dy="0.32em" text-anchor="end">{{ compact(Math.abs(t)) }}</text>
        </g>
        <g class="x-ticks">
          <text v-for="m in xTicks" :key="m" :x="x(m)" :y="height - 6" text-anchor="middle">{{ m }}</text>
        </g>

        <path :d="areaPath" :fill="RADIANT" fill-opacity="0.12" :clip-path="`url(#${uid}-above)`" />
        <path :d="areaPath" :fill="DIRE" fill-opacity="0.12" :clip-path="`url(#${uid}-below)`" />
        <path :d="linePath" fill="none" :stroke="RADIANT" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :clip-path="`url(#${uid}-above)`" />
        <path :d="linePath" fill="none" :stroke="DIRE" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" :clip-path="`url(#${uid}-below)`" />

        <g v-if="hover != null">
          <line class="crosshair" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="height - PAD.b" />
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
        <div class="tt-time">{{ hover }}:00</div>
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
.key i, .tt-row i {
  display: inline-block;
  width: 12px;
  height: 2px;
  border-radius: 1px;
}

.chart-body { position: relative; }
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
.tt-row strong { color: var(--color-text); font-weight: 700; min-width: 3.2rem; }
.tt-row span { color: var(--color-muted, #7a8799); }
</style>
