<script setup>
import { ref, computed, onMounted, onBeforeUnmount, useId } from 'vue'
import { compact, formatTime, heroImage } from '@/utils/matchAnalysis.js'
import HeroIcon from './HeroIcon.vue'

const props = defineProps({
  // [{ key, label, short, kind: 'lead' | 'probability' | 'perHero', values, step, color }]. Leads are Radiant
  // minus Dire; probabilities are Radiant's win probability, 0–1. A perHero series has `heroes: [{ key, hero,
  // isRadiant, values, dots }]` instead of values: one line per hero, labelled with the hero's icon; `dots`
  // (seconds, e.g. level-ups) are marked on the line. Leads and probabilities share a chart split at zero
  // (Radiant above, Dire below); perHero series get a plain chart from zero up. Don't mix the two.
  // `short` names a perHero series' column in the tooltip. Each series keeps its own step (seconds per point).
  // A series, or a perHero series' hero, may have `detail(t)`: extra text shown beside its tooltip value
  // (e.g. last hits/denies next to net worth).
  series: { type: Array, required: true },
  height: { type: Number, default: 150 },
  // Grow to fill the parent's height (never below `height`), e.g. to match a neighbouring panel.
  fill: { type: Boolean, default: false },
  // Heading when several series are overlaid; a lone series is titled by its own label.
  title: { type: String, default: 'Advantage' },
  // [{ key, time, type: 'roshan' | 'wisdom', side: 'radiant' | 'dire', hero }]: marked along the edge
  // of the side that took them (Radiant top, Dire bottom) and listed in the tooltip near their time.
  events: { type: Array, default: () => [] },
})

// Sizes keep each image's own aspect ratio. The Roshan minimap icon is served from public/ because the
// wiki it comes from refuses hotlinked requests.
const EVENT_TYPES = {
  roshan: { icon: `${import.meta.env.BASE_URL}images/roshan.webp`, w: 19, h: 16, label: 'Roshan', verb: 'took the Aegis' },
  wisdom: { icon: 'https://cdn.stratz.com/images/dota2/runes/wisdom.png', w: 16, h: 16, label: 'Wisdom rune', verb: 'took it' },
}

// Validated pair (dark surface #1a1f2b): one series alone is coloured Radiant above the line, Dire below.
const RADIANT = '#45a957'
const DIRE = '#c83c3c'
const PAD = { l: 44, r: 12, t: 10, b: 22 }
// Room on the right for the hero icons that label per-hero lines.
const END_ICON = 16

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
// Heroes switched off with the toggles under a per-hero chart, by hero key.
const hiddenHeroes = ref(new Set())

// Every hero on the per-hero lines, Radiant first, for the toggles.
const toggleHeroes = computed(() => {
  const byKey = new Map()
  for (const s of props.series) {
    if (s.kind !== 'perHero') continue
    for (const hr of s.heroes) if (!byKey.has(hr.key)) byKey.set(hr.key, { key: hr.key, hero: hr.hero, isRadiant: hr.isRadiant })
  }
  return [...byKey.values()].sort((a, b) => Number(b.isRadiant) - Number(a.isRadiant))
})

// The colours of a hero's lines, one per per-hero measure shown: team colour when there's a single measure,
// each measure's own colour when several are overlaid. Drawn under the hero's toggle as its line key.
function heroKeyColors(t) {
  const perHero = props.series.filter(s => s.kind === 'perHero')
  if (perHero.length <= 1) return [t.isRadiant ? RADIANT : DIRE]
  return perHero.map(s => s.color)
}

// Hides or shows a hero's lines, keeping at least one hero on.
function toggleHero(key) {
  const next = new Set(hiddenHeroes.value)
  if (next.has(key)) next.delete(key)
  else if (toggleHeroes.value.some(t => t.key !== key && !next.has(t.key))) next.add(key)
  hiddenHeroes.value = next
}

// Stratz's faction artwork, for the whole-side toggles.
const SIDE_ICONS = {
  radiant: 'https://cdn.stratz.com/images/dota2/radiant_square.png',
  dire: 'https://cdn.stratz.com/images/dota2/dire_square.png',
}

// The heroes grouped by side, each group led by a toggle for the whole side.
const toggleSides = computed(() => [true, false]
  .map(isRadiant => ({
    key: isRadiant ? 'radiant' : 'dire',
    label: isRadiant ? 'Radiant' : 'Dire',
    icon: SIDE_ICONS[isRadiant ? 'radiant' : 'dire'],
    heroes: toggleHeroes.value.filter(t => t.isRadiant === isRadiant),
  }))
  .filter(side => side.heroes.length))

const sideShown = side => side.heroes.some(t => !hiddenHeroes.value.has(t.key))

// Shows a side's heroes if all are hidden, otherwise hides them all, unless that would leave nothing shown.
function toggleSide(side) {
  const next = new Set(hiddenHeroes.value)
  if (!sideShown(side)) side.heroes.forEach(t => next.delete(t.key))
  else if (toggleHeroes.value.some(t => t.isRadiant !== side.heroes[0].isRadiant && !next.has(t.key))) side.heroes.forEach(t => next.add(t.key))
  hiddenHeroes.value = next
}

// The series with hidden heroes left out, so lines, scaling and the tooltip all follow the toggles.
const shown = computed(() => props.series.map(s => (s.kind === 'perHero'
  ? { ...s, heroes: s.heroes.filter(hr => !hiddenHeroes.value.has(hr.key)) }
  : s)))

const hasPerHero = computed(() => props.series.some(s => s.kind === 'perHero'))
const padR = computed(() => (hasPerHero.value ? END_ICON + 8 : PAD.r))
const plotW = computed(() => width.value - PAD.l - padR.value)
const plotH = computed(() => h.value - PAD.t - PAD.b)
const single = computed(() => props.series.length === 1)
// Plain line chart (values from zero up) rather than one split into Radiant and Dire halves.
const normal = computed(() => props.series.length > 0 && props.series.every(s => s.kind === 'perHero'))

function niceStep(range, count) {
  const raw = range / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

// Everything is drawn on one -1..1 scale with Radiant above the zero line. A lone lead is scaled to a
// round number so its axis can show real values; overlaid leads are each scaled to their own peak, so
// lines of different units share the chart without a second axis. Win probability maps 50% to the line.
// A series' raw values, all heroes' together for a perHero one (for scaling and length).
const allValues = s => (s.kind === 'perHero' ? s.heroes.flatMap(hr => hr.values) : s.values)
const pointCount = s => (s.kind === 'perHero' ? Math.max(0, ...s.heroes.map(hr => hr.values.length)) : s.values.length)

const scaled = computed(() => shown.value.map(s => {
  if (s.kind === 'probability') return { ...s, norm: v => (v - 0.5) * 2 }
  const peak = Math.max(200, ...allValues(s).map(Math.abs))
  const unit = niceStep(peak, 3)
  const scale = single.value ? Math.ceil(peak / unit) * unit : peak
  return { ...s, unit, scale, norm: v => v / scale }
}))

const duration = computed(() => Math.max(60, ...shown.value.map(s => (pointCount(s) - 1) * s.step)))
const finest = computed(() => Math.min(...props.series.map(s => s.step)))

const x = t => PAD.l + (t / duration.value) * plotW.value
// Split: n runs -1 (Dire) to 1 (Radiant) with zero mid-height. Normal: 0 at the bottom to 1 at the top.
const y = n => PAD.t + (normal.value ? 1 - n : (1 - n) / 2) * plotH.value
const zeroY = computed(() => y(0))

function path(s, values, sign = 1) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${x(i * s.step).toFixed(1)},${y(s.norm(sign * v)).toFixed(1)}`).join('')
}
const lines = computed(() => scaled.value.map(s => ({ ...s, d: s.kind === 'perHero' ? '' : path(s, s.values) })))

const perHeroSeries = computed(() => scaled.value.filter(s => s.kind === 'perHero'))

// Heroes whose lines are dashed: the second hero on a side that has exactly two (a lane's core and support),
// so the pair stays apart where they cross. Worked out from all heroes, not just the visible ones, so a
// line's style (and its key under the chart) doesn't change when the other hero is hidden.
const dashedHeroes = computed(() => {
  const dashed = new Set()
  const first = props.series.find(s => s.kind === 'perHero')
  for (const isRadiant of [true, false]) {
    const side = first?.heroes.filter(hr => hr.isRadiant === isRadiant) ?? []
    if (side.length === 2) dashed.add(side[1].key)
  }
  return dashed
})

// One line per hero for perHero series (Radiant's up and Dire's down in a split chart). In a lane, a
// side's second hero is dashed (see dashedHeroes); with a whole team the icons tell them apart.
const heroTracks = computed(() => perHeroSeries.value.flatMap(s => {
  return s.heroes.map(hr => {
    const side = hr.isRadiant ? 'radiant' : 'dire'
    const sign = normal.value || hr.isRadiant ? 1 : -1
    const last = hr.values.length - 1
    const at = t => valueAt({ values: hr.values, step: s.step }, t)
    return {
      key: `${s.key}:${hr.key}`,
      heroKey: hr.key,
      detail: hr.detail ?? null,
      s,
      hero: hr.hero,
      isRadiant: hr.isRadiant,
      values: hr.values,
      side,
      sign,
      dashed: dashedHeroes.value.has(hr.key),
      color: single.value ? (hr.isRadiant ? RADIANT : DIRE) : s.color,
      d: path(s, hr.values, sign),
      endX: x(last * s.step),
      endY: y(s.norm(sign * (hr.values[last] ?? 0))),
      // Marks along the line (level-ups for experience) within the visible range.
      dots: (hr.dots ?? [])
        .filter(t => t > 0 && at(t) != null)
        .map(t => ({ t, cx: x(t), cy: y(s.norm(sign * at(t))) })),
    }
  })
}))

// Hero icons where each per-hero line ends, nudged apart so close finishes don't overlap, and kept inside
// the plot. With several measures for a whole team that would be dozens, so only the first is labelled.
const endIcons = computed(() => {
  const tracks = heroTracks.value.length > 12 ? heroTracks.value.filter(t => t.s.key === perHeroSeries.value[0].key) : heroTracks.value
  const icons = tracks
    .map(t => ({ key: t.key, hero: t.hero, src: heroImage(t.hero), x: t.endX + 4, y: t.endY - END_ICON / 2 }))
    .filter(i => i.src)
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < icons.length; i++) icons[i].y = Math.max(icons[i].y, icons[i - 1].y + END_ICON + 1)
  // Pushed past the bottom: walk back up from the floor.
  const floor = h.value - PAD.b - END_ICON
  for (let i = icons.length - 1; i >= 0; i--) {
    const limit = i === icons.length - 1 ? floor : icons[i + 1].y - END_ICON - 1
    icons[i].y = Math.max(PAD.t - 4, Math.min(icons[i].y, limit))
  }
  return icons
})

// Grid lines in scaled units, labelled in real ones when a single series makes that possible.
const yTicks = computed(() => {
  if (normal.value) {
    // Several measures are each scaled to their own peak, so only a lone one gets real values.
    if (!single.value) return [1, 0.75, 0.5, 0.25, 0].map(n => ({ n, label: '' }))
    const s = scaled.value[0]
    const ticks = []
    for (let v = 0; v <= s.scale + 1e-9; v += s.unit) ticks.push({ n: v / s.scale, label: compact(v) })
    return ticks
  }
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

// Markers in the visible time range. One that would overlap the previous marker on its edge is nudged
// right so both stay readable.
const markers = computed(() => {
  // Right edge of the last marker placed on each side.
  const lastRight = { radiant: -Infinity, dire: -Infinity }
  return props.events
    .filter(e => e.time >= 0 && e.time <= duration.value)
    .map(e => {
      const t = EVENT_TYPES[e.type]
      const cx = Math.max(x(e.time), lastRight[e.side] + t.w / 2 + 1)
      lastRight[e.side] = cx + t.w / 2
      const cy = e.side === 'radiant' ? PAD.t + t.h / 2 + 2 : h.value - PAD.b - t.h / 2 - 2
      return { ...e, cx, cy, ...t }
    })
})
const eventTypesShown = computed(() => Object.entries(EVENT_TYPES)
  .filter(([type]) => markers.value.some(m => m.type === type))
  .map(([type, t]) => ({ type, ...t })))

// Events within half a minute of the hovered time, for the tooltip.
const hoverEvents = computed(() => (hover.value == null ? [] : markers.value.filter(m => Math.abs(m.time - hover.value) <= 30)))

const hoverRows = computed(() => {
  if (hover.value == null) return []
  return scaled.value
    .filter(s => s.kind !== 'perHero')
    .map(s => ({ s, v: valueAt(s, hover.value) }))
    .filter(r => r.v != null)
})

// Each hero's value on the per-hero lines at the hovered time, for the dots.
const hoverTracks = computed(() => {
  if (hover.value == null) return []
  return heroTracks.value
    .map(t => ({ t, v: valueAt({ values: t.values, step: t.s.step }, hover.value) }))
    .filter(r => r.v != null)
})

// The tooltip's per-hero table: a section per side, one row per hero and one column per perHero series,
// with the side's combined value for each column in brackets beside its name.
const heroSections = computed(() => {
  if (hover.value == null || !perHeroSeries.value.length) return []
  return [true, false].map(isRadiant => {
    const heroes = new Map()
    for (const t of heroTracks.value.filter(t => t.isRadiant === isRadiant)) {
      if (!heroes.has(t.heroKey)) heroes.set(t.heroKey, { key: t.heroKey, hero: t.hero, cells: {}, details: {} })
      const row = heroes.get(t.heroKey)
      row.cells[t.s.key] = valueAt({ values: t.values, step: t.s.step }, hover.value)
      row.details[t.s.key] = t.detail?.(hover.value) ?? null
    }
    const rows = [...heroes.values()]
    const totals = perHeroSeries.value.map(s => rows.reduce((sum, r) => sum + (r.cells[s.key] ?? 0), 0))
    return { key: isRadiant ? 'radiant' : 'dire', label: isRadiant ? 'Radiant' : 'Dire', rows, totals }
  }).filter(sec => sec.rows.length)
})

const tooltipStyle = computed(() => {
  if (hover.value == null) return {}
  const px = x(hover.value)
  return px > width.value - (perHeroSeries.value.length ? 60 + perHeroSeries.value.length * 60 : 210) ? { right: `${width.value - px + 10}px` } : { left: `${px + 10}px` }
})

const heading = computed(() => (single.value ? props.series[0].label : props.title))

const summary = computed(() => props.series
  .map(s => {
    if (s.kind === 'perHero') {
      return `${s.label}: ${s.heroes.map(hr => `${hr.hero?.displayName ?? 'Hero'} ${compact(hr.values.at(-1) ?? 0)}`).join(', ')}`
    }
    const end = s.values.at(-1) ?? 0
    return `${s.label}: ${display(s, end)} ${sideShort(s, end)} at ${formatTime((s.values.length - 1) * s.step)}`
  })
  .join('; '))
</script>

<template>
  <div ref="root" class="advantage-chart" :class="{ fill }">
    <div class="chart-head">
      <span class="chart-title">
        {{ heading }}
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
        <span v-for="t in eventTypesShown" :key="t.type" class="key">
          <img :src="t.icon" class="key-icon" alt="" />{{ t.label }}
        </span>
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

        <!-- Radiant's half tinted green and Dire's red, so which side a line favours reads at a glance. -->
        <template v-if="!normal">
          <rect class="zone" :x="PAD.l" :y="PAD.t" :width="plotW" :height="zeroY - PAD.t" :fill="RADIANT" />
          <rect class="zone" :x="PAD.l" :y="zeroY" :width="plotW" :height="h - PAD.b - zeroY" :fill="DIRE" />
        </template>

        <g class="grid">
          <line v-for="t in yTicks" :key="t.n" :x1="PAD.l" :x2="width - padR" :y1="y(t.n)" :y2="y(t.n)" :class="{ zero: t.n === 0 }" />
        </g>
        <g class="y-ticks">
          <text v-for="t in yTicks" :key="t.n" :x="PAD.l - 6" :y="y(t.n)" dy="0.32em" text-anchor="end">{{ t.label }}</text>
        </g>
        <g class="x-ticks">
          <text v-for="t in xTicks" :key="t.t" :x="x(t.t)" :y="h - 6" text-anchor="middle">{{ t.label }}</text>
        </g>

        <!-- One lead or probability series: green above the line and red below. -->
        <template v-if="single && lines[0].kind !== 'perHero'">
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
            v-for="l in lines.filter(l => l.kind !== 'perHero')"
            :key="l.key"
            :d="l.d"
            class="line"
            :stroke="l.color"
            :stroke-dasharray="l.kind === 'probability' ? '5 4' : null"
          />
        </template>
        <!-- Per-hero lines, labelled by the hero's icon where each ends. -->
        <path
          v-for="t in heroTracks"
          :key="t.key"
          :d="t.d"
          class="line"
          :stroke="t.color"
          :stroke-dasharray="t.dashed ? '6 3' : null"
        />
        <circle
          v-for="dot in heroTracks.flatMap(t => t.dots.map(d => ({ ...d, key: `${t.key}:${d.t}`, color: t.color })))"
          :key="dot.key"
          :cx="dot.cx"
          :cy="dot.cy"
          r="2.4"
          :fill="dot.color"
          class="line-dot"
        />
        <image
          v-for="i in endIcons"
          :key="`icon-${i.key}`"
          :href="i.src"
          :x="i.x"
          :y="i.y"
          :width="END_ICON"
          :height="END_ICON"
          class="end-icon"
        ><title>{{ i.hero?.displayName }}</title></image>

        <!-- Objectives: an icon on the taking side's edge (Radiant top, Dire bottom), with a faint tick down to the zero line. -->
        <g class="markers">
          <g v-for="m in markers" :key="m.key">
            <line class="marker-tick" :x1="m.cx" :x2="m.cx" :y1="m.cy" :y2="zeroY" />
            <image :href="m.icon" :x="m.cx - m.w / 2" :y="m.cy - m.h / 2" :width="m.w" :height="m.h" class="marker-icon" />
            <title>{{ m.label }} · {{ m.hero?.displayName ?? 'Unknown hero' }} ({{ m.side === 'radiant' ? 'Radiant' : 'Dire' }}) {{ m.verb }} at {{ formatTime(m.time) }}</title>
          </g>
        </g>

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
          <circle
            v-for="r in hoverTracks"
            :key="r.t.key"
            :cx="x(hover)"
            :cy="y(r.t.s.norm(r.t.sign * r.v))"
            r="4"
            :fill="r.t.color"
            class="hover-dot"
          />
        </g>
      </svg>

      <div v-if="hover != null && (hoverRows.length || heroSections.length)" class="tooltip" :style="tooltipStyle">
        <div class="tt-time">{{ formatTime(hover) }}</div>
        <div v-for="m in hoverEvents" :key="m.key" class="tt-event">
          <img :src="m.icon" class="key-icon" alt="" />
          <HeroIcon :hero="m.hero" class="tt-event-hero" />
          <span>{{ m.label }} · {{ formatTime(m.time) }}</span>
        </div>
        <div v-for="r in hoverRows" :key="r.s.key" class="tt-row">
          <i :class="{ dashed: !single && r.s.kind === 'probability' }" :style="{ color: single ? sideColor(r.s, r.v) : r.s.color }" />
          <strong>{{ display(r.s, r.v) }}</strong>
          <span>{{ r.s.label }} · {{ sideShort(r.s, r.v) }}</span>
          <small v-if="r.s.detail" class="tt-detail">{{ r.s.detail(hover) }}</small>
        </div>
        <div v-for="sec in heroSections" :key="sec.key" class="tt-heroes" :style="{ '--cols': perHeroSeries.length }">
          <div class="tt-side">
            {{ sec.label }}
            <span class="tt-side-total">({{ sec.totals.map(compact).join(' · ') }})</span>
          </div>
          <!-- Column names, with each measure's line colour when several are shown. -->
          <div class="tt-hero tt-hero-key">
            <span />
            <span v-for="s in perHeroSeries" :key="s.key" class="tt-col">
              <i v-if="!single" :style="{ color: s.color }" />{{ s.short ?? s.label }}
            </span>
          </div>
          <div v-for="r in sec.rows" :key="r.key" class="tt-hero">
            <HeroIcon :hero="r.hero" class="tt-hero-icon" />
            <strong v-for="s in perHeroSeries" :key="s.key">
              {{ r.cells[s.key] == null ? '—' : compact(r.cells[s.key]) }}<small v-if="r.details[s.key]" class="tt-detail">{{ r.details[s.key] }}</small>
            </strong>
          </div>
        </div>
      </div>
    </div>
    <div class="x-label">Minute</div>

    <!-- Per-hero charts: per side, a toggle for the whole side and one for each hero, to show or hide lines.
         The side emblems sit on the outside (Radiant left, Dire right) with a dot between the teams. -->
    <div v-if="toggleHeroes.length" class="hero-toggles" role="group" aria-label="Heroes shown">
      <template v-for="(side, si) in toggleSides" :key="side.key">
      <span v-if="si > 0" class="team-dot" aria-hidden="true" />
      <div class="toggle-side" :class="`side-${side.key}`">
        <button
          type="button"
          class="hero-toggle side-toggle"
          :class="[`toggle-${side.key}`, { off: !sideShown(side) }]"
          :aria-pressed="sideShown(side)"
          :title="`${sideShown(side) ? 'Hide' : 'Show'} all of ${side.label}`"
          @click="toggleSide(side)"
        >
          <img :src="side.icon" :alt="side.label" class="hero-toggle-icon" />
        </button>
        <span class="toggle-sep" aria-hidden="true" />
        <button
          v-for="t in side.heroes"
          :key="t.key"
          type="button"
          class="hero-toggle"
          :class="[t.isRadiant ? 'toggle-radiant' : 'toggle-dire', { off: hiddenHeroes.has(t.key), dashed: dashedHeroes.has(t.key) }]"
          :aria-pressed="!hiddenHeroes.has(t.key)"
          :title="`${hiddenHeroes.has(t.key) ? 'Show' : 'Hide'} ${t.hero?.displayName ?? 'hero'}`"
          @click="toggleHero(t.key)"
        >
          <HeroIcon :hero="t.hero" class="hero-toggle-icon" />
          <!-- This hero's line key: a segment per line colour, dashed if the hero's lines are. -->
          <span class="hero-key-line" aria-hidden="true">
            <i v-for="(c, ci) in heroKeyColors(t)" :key="ci" :style="{ color: c }" />
          </span>
        </button>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.advantage-chart { position: relative; min-width: 0; }

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
.advantage-chart.fill { display: flex; flex-direction: column; height: 100%; }
.advantage-chart.fill .chart-body { flex: 1; }
.advantage-chart.fill .chart-svg { position: absolute; top: 0; left: 0; }
.chart-svg { display: block; max-width: 100%; outline: none; touch-action: pan-y; }
.chart-svg:focus-visible { outline: 1px solid var(--color-accent, #34bfff); outline-offset: 2px; border-radius: 4px; }

.zone { fill-opacity: 0.07; }
.marker-tick { stroke: #7a8799; stroke-opacity: 0.35; stroke-width: 1; stroke-dasharray: 2 3; }
.marker-icon { cursor: default; }
.end-icon { clip-path: inset(0 round 3px); }
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

/* Hero toggles: underlined in their team's colour; a switched-off hero is greyed out. */
.hero-toggles { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem 1.1rem; margin-top: 0.45rem; }
.toggle-side { display: flex; align-items: center; gap: 0.3rem; }
/* Dire mirrors Radiant: heroes first, then the divider and the emblem on the outside. */
.side-dire .toggle-sep { order: 1; }
.side-dire .side-toggle { order: 2; }
.team-dot { align-self: center; width: 4px; height: 4px; border-radius: 50%; background: var(--color-muted, #7a8799); }
/* Divides a side's toggle from its heroes. */
.toggle-sep { width: 1px; height: 20px; background: var(--color-border, #2e3542); margin: 0 0.1rem; }
.hero-toggle {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
}
.toggle-radiant { border-bottom-color: #45a957; }
.toggle-dire { border-bottom-color: #c83c3c; }
/* Hero toggles carry their own line key below the icon, so no team underline. */
.hero-toggles .hero-toggle:not(.side-toggle) { border-bottom-color: transparent; }
.hero-key-line { display: flex; gap: 1px; }
.hero-key-line i { flex: 1; border-top: 2px solid currentColor; }
.hero-toggle.dashed .hero-key-line i { border-top-style: dashed; }
.hero-toggle.off .hero-key-line i { color: var(--color-border, #2e3542) !important; }
.hero-toggle.off { opacity: 0.35; filter: grayscale(1); border-bottom-color: var(--color-border, #2e3542); }
.hero-toggle:hover { opacity: 1; }
.hero-toggle:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }
.hero-toggle :deep(img), .hero-toggle-icon { display: block; width: 26px; height: 26px; border-radius: 3px; object-fit: cover; }

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
/* Level-up (or other) marks on a line, ringed in the surface colour so they read over other lines. */
.line-dot { stroke: var(--color-surface, #1a1f2b); stroke-width: 1; pointer-events: none; }
/* Supporting numbers beside a value, e.g. last hits/denies next to net worth. */
.tt-detail { margin-left: 0.3rem; font-size: 0.64rem; font-weight: 500; color: var(--color-muted, #7a8799); }
.tt-side-total { font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--color-text); margin-left: 0.25rem; }
.tt-col { display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.25rem; font-size: 0.6rem; color: var(--color-muted, #7a8799); }
.tt-col i { display: inline-block; width: 10px; border-top: 2px solid currentColor; }
/* The objective icons again, in the legend and tooltip. */
.key-icon { display: block; height: 14px; width: auto; }
.tt-event {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: var(--color-muted, #7a8799);
  white-space: nowrap;
  margin-bottom: 0.15rem;
}
.tt-event :deep(img), .tt-event-hero { width: 18px; height: 18px; border-radius: 3px; object-fit: cover; }
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
  grid-template-columns: 20px repeat(var(--cols), minmax(2.6rem, auto));
  align-items: center;
  column-gap: 0.5rem;
  font-size: 0.72rem;
  padding: 0.08rem 0;
  white-space: nowrap;
}
.tt-hero :deep(img) { width: 20px; height: 20px; border-radius: 3px; object-fit: cover; }
.tt-hero strong { color: var(--color-text); font-weight: 700; text-align: right; }
.tt-row span { color: var(--color-muted, #7a8799); }
</style>
