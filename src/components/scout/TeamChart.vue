<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'
import { compact, formatTime } from '@/utils/matchAnalysis.js'

const props = defineProps({
  // [{ key, label, kind: 'lead' | 'probability', values, step, color }]. Leads are Radiant minus Dire;
  // probabilities are Radiant's win probability, 0–1. Each series keeps its own step (seconds between points).
  series: { type: Array, required: true },
  height: { type: Number, default: 150 },
  // Grow to fill the parent's height (never below `height`), e.g. to match a neighbouring panel.
  fill: { type: Boolean, default: false },
})

// Same validated pair as LeadChart: one series alone keeps the Radiant-above / Dire-below colouring.
const RADIANT = '#45a957'
const DIRE = '#c83c3c'
const PAD = { l: 44, r: 12, t: 10, b: 22 }

const uid = useId()
const root = ref(null)
const body = ref(null)
const bodyHeight = ref(0)
const width = ref(560)
// Hovered time in seconds.
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
const plotW = computed(() => width.value - PAD.l - PAD.r)
const plotH = computed(() => h.value - PAD.t - PAD.b)
const single = computed(() => props.series.length === 1)

function niceStep(range, count) {
  const raw = range / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

// Everything is drawn on one -1..1 scale with Radiant above the zero line. A lone lead is scaled to a
// round number so its axis can show real values; overlaid leads are each scaled to their own peak, so
// lines of different units share the chart without a second axis. Win probability maps 50% to the line.
const scaled = computed(() => props.series.map(s => {
  if (s.kind === 'probability') return { ...s, norm: v => (v - 0.5) * 2 }
  const peak = Math.max(200, ...s.values.map(Math.abs))
  const unit = niceStep(peak, 3)
  const scale = single.value ? Math.ceil(peak / unit) * unit : peak
  return { ...s, unit, scale, norm: v => v / scale }
}))

const duration = computed(() => Math.max(60, ...props.series.map(s => (s.values.length - 1) * s.step)))
const finest = computed(() => Math.min(...props.series.map(s => s.step)))

const x = t => PAD.l + (t / duration.value) * plotW.value
const y = n => PAD.t + ((1 - n) / 2) * plotH.value
const zeroY = computed(() => y(0))

function path(s) {
  return s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i * s.step).toFixed(1)},${y(s.norm(v)).toFixed(1)}`).join('')
}
const lines = computed(() => scaled.value.map(s => ({ ...s, d: path(s) })))

// Grid lines in scaled units, labelled in real ones when a single series makes that possible.
const yTicks = computed(() => {
  if (!single.value) {
    return [
      { n: 1, label: 'Radiant' },
      { n: 0.5, label: '' },
      { n: 0, label: '' },
      { n: -0.5, label: '' },
      { n: -1, label: 'Dire' },
    ]
  }
  const s = scaled.value[0]
  if (s.kind === 'probability') {
    return [1, 0.5, 0, -0.5, -1].map(n => ({ n, label: `${Math.round((Math.abs(n) / 2 + 0.5) * 100)}%` }))
  }
  const ticks = []
  for (let v = -s.scale; v <= s.scale + 1e-9; v += s.unit) ticks.push({ n: v / s.scale, label: compact(Math.abs(v)) })
  return ticks
})

const xTicks = computed(() => {
  const lastMinute = Math.floor(duration.value / 60)
  const every = lastMinute <= 12 ? (plotW.value < 360 ? 2 : 1) : lastMinute <= 30 ? 5 : 10
  const ticks = []
  for (let m = 0; m <= lastMinute; m += every) ticks.push({ t: m * 60, label: m })
  return ticks
})

// The series' value at time t, or null past its last point (Stratz's win probabilities can stop short).
function valueAt(s, t) {
  const i = Math.round(t / s.step)
  return i < s.values.length ? s.values[i] : null
}

function sideShort(s, v) {
  const lean = s.kind === 'probability' ? v - 0.5 : v
  return lean > 0 ? 'Radiant' : lean < 0 ? 'Dire' : 'even'
}

function display(s, v) {
  if (s.kind === 'probability') return `${Math.round(Math.max(v, 1 - v) * 100)}%`
  return compact(Math.abs(v))
}

function sideColor(s, v) {
  return sideShort(s, v) === 'Dire' ? DIRE : RADIANT
}

const snap = t => Math.max(0, Math.min(duration.value, Math.round(t / finest.value) * finest.value))

function onMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * width.value
  hover.value = snap(((px - PAD.l) / plotW.value) * duration.value)
}

function onKey(e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const start = hover.value ?? (e.key === 'ArrowLeft' ? duration.value + finest.value : -finest.value)
  // Shift jumps a whole minute, which matters when points are seconds apart.
  const by = e.shiftKey ? Math.max(finest.value, 60) : finest.value
  hover.value = snap(start + (e.key === 'ArrowRight' ? by : -by))
}

const hoverRows = computed(() => {
  if (hover.value == null) return []
  return scaled.value
    .map(s => ({ s, v: valueAt(s, hover.value) }))
    .filter(r => r.v != null)
})

const tooltipStyle = computed(() => {
  if (hover.value == null) return {}
  const px = x(hover.value)
  return px > width.value - 210 ? { right: `${width.value - px + 10}px` } : { left: `${px + 10}px` }
})

const title = computed(() => (single.value ? props.series[0].label : 'Team Advantage'))

const summary = computed(() => props.series
  .map(s => {
    const end = s.values.at(-1) ?? 0
    return `${s.label}: ${display(s, end)} ${sideShort(s, end)} at ${formatTime((s.values.length - 1) * s.step)}`
  })
  .join('; '))
</script>

<template>
  <div ref="root" class="team-chart" :class="{ fill }">
    <div class="chart-head">
      <span class="chart-title">
        {{ title }}
        <span v-if="!single" class="chart-note">· each line scaled to its own peak</span>
      </span>
      <span class="legend">
        <template v-if="single">
          <span class="key"><i :style="{ background: RADIANT }" />Radiant</span>
          <span class="key"><i :style="{ background: DIRE }" />Dire</span>
        </template>
        <template v-else>
          <span v-for="s in series" :key="s.key" class="key">
            <i class="key-line" :class="{ dashed: s.kind === 'probability' }" :style="{ color: s.color }" />{{ s.label }}
          </span>
        </template>
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
          <line v-for="t in yTicks" :key="t.n" :x1="PAD.l" :x2="width - PAD.r" :y1="y(t.n)" :y2="y(t.n)" :class="{ zero: t.n === 0 }" />
        </g>
        <g class="y-ticks">
          <text v-for="t in yTicks" :key="t.n" :x="PAD.l - 6" :y="y(t.n)" dy="0.32em" text-anchor="end">{{ t.label }}</text>
        </g>
        <g class="x-ticks">
          <text v-for="t in xTicks" :key="t.t" :x="x(t.t)" :y="h - 6" text-anchor="middle">{{ t.label }}</text>
        </g>

        <!-- One series: green above the line and red below, as in the lane charts. -->
        <template v-if="single">
          <path
            :d="`${lines[0].d}L${x((lines[0].values.length - 1) * lines[0].step).toFixed(1)},${zeroY.toFixed(1)}L${x(0).toFixed(1)},${zeroY.toFixed(1)}Z`"
            :fill="RADIANT" fill-opacity="0.12" :clip-path="`url(#${uid}-above)`"
          />
          <path
            :d="`${lines[0].d}L${x((lines[0].values.length - 1) * lines[0].step).toFixed(1)},${zeroY.toFixed(1)}L${x(0).toFixed(1)},${zeroY.toFixed(1)}Z`"
            :fill="DIRE" fill-opacity="0.12" :clip-path="`url(#${uid}-below)`"
          />
          <path :d="lines[0].d" class="line" :stroke="RADIANT" :clip-path="`url(#${uid}-above)`" />
          <path :d="lines[0].d" class="line" :stroke="DIRE" :clip-path="`url(#${uid}-below)`" />
        </template>
        <!-- Several: one colour per measure, win probability dashed since it isn't a lead. -->
        <template v-else>
          <path
            v-for="l in lines"
            :key="l.key"
            :d="l.d"
            class="line"
            :stroke="l.color"
            :stroke-dasharray="l.kind === 'probability' ? '5 4' : null"
          />
        </template>

        <g v-if="hover != null">
          <line class="crosshair" :x1="x(hover)" :x2="x(hover)" :y1="PAD.t" :y2="h - PAD.b" />
          <circle
            v-for="r in hoverRows"
            :key="r.s.key"
            :cx="x(hover)"
            :cy="y(r.s.norm(r.v))"
            r="4.5"
            :fill="single ? sideColor(r.s, r.v) : r.s.color"
            class="hover-dot"
          />
        </g>
      </svg>

      <div v-if="hover != null && hoverRows.length" class="tooltip" :style="tooltipStyle">
        <div class="tt-time">{{ formatTime(hover) }}</div>
        <div v-for="r in hoverRows" :key="r.s.key" class="tt-row">
          <i :class="{ dashed: !single && r.s.kind === 'probability' }" :style="{ color: single ? sideColor(r.s, r.v) : r.s.color }" />
          <strong>{{ display(r.s, r.v) }}</strong>
          <span>{{ r.s.label }} · {{ sideShort(r.s, r.v) }}</span>
        </div>
      </div>
    </div>
    <div class="x-label">Minute</div>
  </div>
</template>

<style scoped>
.team-chart { position: relative; min-width: 0; }

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
.chart-note { font-weight: 400; color: var(--color-muted, #7a8799); }
.legend { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; }
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
/* Line keys draw in currentColor so the dashed one can be a border. */
.key i.key-line,
.tt-row i {
  display: inline-block;
  width: 12px;
  height: 0;
  border-radius: 0;
  border-top: 2px solid currentColor;
}
.key i.dashed,
.tt-row i.dashed { border-top-style: dashed; }

.chart-body { position: relative; }
/* In fill mode the body takes the spare height and the SVG is sized from it, so it can't push back. */
.team-chart.fill { display: flex; flex-direction: column; height: 100%; }
.team-chart.fill .chart-body { flex: 1; }
.team-chart.fill .chart-svg { position: absolute; top: 0; left: 0; }
.chart-svg { display: block; max-width: 100%; outline: none; touch-action: pan-y; }
.chart-svg:focus-visible { outline: 1px solid var(--color-accent, #34bfff); outline-offset: 2px; border-radius: 4px; }

.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
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
