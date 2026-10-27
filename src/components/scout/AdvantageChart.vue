<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import { compact, formatTime, heroImage } from '@/utils/matchAnalysis.js'
import HeroIcon from './HeroIcon.vue'
import LineKey from './LineKey.vue'

const props = defineProps({
  // [{ key, label, short, kind: 'lead' | 'probability' | 'perHero', values, step, color }]. Leads are Radiant
  // minus Dire; probabilities are Radiant's win probability, 0–1. A perHero series has `heroes: [{ key, hero,
  // isRadiant, color, values, dots }]` instead of values: one line per hero in the hero's player colour,
  // labelled with the hero's icon; `dots`
  // (seconds, e.g. level-ups) are marked on the line. Leads and probabilities share a chart split at zero
  // (Radiant above, Dire below); perHero series get a plain chart from zero up. Don't mix the two.
  // A lead series may carry `heroes` (same shape) instead of values: its line is then the shown Radiant
  // heroes' total minus the shown Dire heroes', so the hero toggles choose who counts.
  // `short` names a perHero series' column in the tooltip. Optional `minPeak` (default 200) is the
  // smallest top of scale, and `format(v)` formats a tooltip value (default: compact number). Each series keeps its own step (seconds per point).
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

// Expanded: the chart (with its controls) is laid over the page to fill the browser window, and fills it
// like fill mode. Esc or the button puts it back; the page doesn't scroll meanwhile.
const expanded = ref(false)
function setExpanded(on) {
  expanded.value = on
  document.documentElement.style.overflow = on ? 'hidden' : ''
}
const onExpandedKey = e => { if (e.key === 'Escape' && expanded.value) setExpanded(false) }
const filling = computed(() => props.fill || expanded.value)

onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(240, entry.contentRect.width) })
  observer.observe(root.value)
  // Always watched, as expanding can make any chart fill.
  bodyObserver = new ResizeObserver(([entry]) => { bodyHeight.value = entry.contentRect.height })
  bodyObserver.observe(body.value)
  window.addEventListener('keydown', onExpandedKey)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  bodyObserver?.disconnect()
  window.removeEventListener('keydown', onExpandedKey)
  if (expanded.value) setExpanded(false)
})

const h = computed(() => (filling.value ? Math.max(props.height, Math.floor(bodyHeight.value)) : props.height))
// Heroes switched off with the toggles under a per-hero chart, by hero key.
const hiddenHeroes = ref(new Set())

// Every hero on the per-hero lines, Radiant first, for the toggles.
const toggleHeroes = computed(() => {
  const byKey = new Map()
  for (const s of props.series) {
    if (!s.heroes) continue
    for (const hr of s.heroes) if (!byKey.has(hr.key)) byKey.set(hr.key, { key: hr.key, hero: hr.hero, isRadiant: hr.isRadiant, color: heroColor(hr) })
  }
  return [...byKey.values()].sort((a, b) => Number(b.isRadiant) - Number(a.isRadiant))
})

// Per-hero lines are coloured by hero (their in-game player colour), so overlaid measures are told apart
// by line style instead, in this order: solid, dashed, dotted. Keys are drawn with LineKey, the same way.
// Win probability's own pattern (dash-dot), distinct from every measure's.
const PROB_DASH = '9 3 1 3'

const LINE_STYLES = [
  { dash: null },
  { dash: '7 4' },
  { dash: '1 4' },
]
function lineStyle(seriesKey) {
  const i = props.series.filter(s => s.kind === 'perHero').findIndex(s => s.key === seriesKey)
  return LINE_STYLES[Math.max(0, i) % LINE_STYLES.length]
}

// The colour bar under a hero's toggle: their line colour. Measures' line styles are in the legend, so the
// bar stays solid. With no per-hero lines (a team lead chart) the hero counts towards their team's line,
// so it's the team colour.
function heroKeyColor(t) {
  return props.series.some(s => s.kind === 'perHero') ? t.color : (t.isRadiant ? RADIANT : DIRE)
}

// Hides or shows a hero's lines.
function toggleHero(key) {
  const next = new Set(hiddenHeroes.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
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

// Shows a side's heroes if all are hidden, otherwise hides them all.
function toggleSide(side) {
  const next = new Set(hiddenHeroes.value)
  if (!sideShown(side)) side.heroes.forEach(t => next.delete(t.key))
  else side.heroes.forEach(t => next.add(t.key))
  hiddenHeroes.value = next
}

// The series with hidden heroes left out, so lines, scaling and the tooltip all follow the toggles.
const shown = computed(() => props.series.map(s => {
  if (!s.heroes) return s
  const heroes = s.heroes.filter(hr => !hiddenHeroes.value.has(hr.key))
  if (s.kind === 'perHero') return { ...s, heroes }
  return { ...s, values: heroLead(heroes) }
}))

// Radiant's shown heroes' total minus Dire's, point by point; empty when no hero is shown.
function heroLead(heroes) {
  if (!heroes.length) return []
  const len = Math.min(...heroes.map(hr => hr.values.length))
  return Array.from({ length: len }, (_, i) => heroes.reduce((sum, hr) => sum + (hr.isRadiant ? 1 : -1) * (hr.values[i] ?? 0), 0))
}

const hasPerHero = computed(() => props.series.some(s => s.kind === 'perHero'))
const padR = computed(() => (hasPerHero.value ? END_ICON + 8 : PAD.r))
const plotW = computed(() => width.value - PAD.l - padR.value)
const plotH = computed(() => h.value - PAD.t - PAD.b)
const single = computed(() => props.series.length === 1)
// Plain line chart (values from zero up) rather than one split into Radiant and Dire halves.
// Any per-hero series makes it a plain chart; a probability shown with them runs 0% to 100% bottom to top.
const normal = computed(() => props.series.some(s => s.kind === 'perHero') && props.series.every(s => s.kind === 'perHero' || s.kind === 'probability'))

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
  // Radiant's chance: 50% on the zero line of a split chart, or 0–100% bottom to top of a plain one.
  if (s.kind === 'probability') return { ...s, norm: v => (normal.value ? v : (v - 0.5) * 2) }
  const peak = Math.max(s.minPeak ?? 200, ...allValues(s).map(Math.abs))
  const unit = niceStep(peak, 3)
  const scale = single.value ? Math.ceil(peak / unit) * unit : peak
  return { ...s, unit, scale, norm: v => v / scale }
}))

const duration = computed(() => Math.max(60, ...shown.value.map(s => (pointCount(s) - 1) * s.step)))
// 60 when nothing is shown, so hover snapping still has a step.
const finest = computed(() => Math.min(60, ...props.series.map(s => s.step)))

// Nothing to draw: no measure picked, or every hero hidden. The axes stay, with a hint in the middle.
const emptyHint = computed(() => {
  if (!props.series.length) return 'Select a measure above to show it'
  const nothingLeft = shown.value.every(s => (s.kind === 'perHero' ? !s.heroes.length : !s.values?.length))
  return nothingLeft ? 'Select a hero below to show their line' : null
})

const x = t => PAD.l + (t / duration.value) * plotW.value
// Split: n runs -1 (Dire) to 1 (Radiant) with zero mid-height. Normal: 0 at the bottom to 1 at the top.
const y = n => PAD.t + (normal.value ? 1 - n : (1 - n) / 2) * plotH.value
const zeroY = computed(() => y(0))

function path(s, values, sign = 1) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${x(i * s.step).toFixed(1)},${y(s.norm(sign * v)).toFixed(1)}`).join('')
}
const lines = computed(() => scaled.value.map(s => ({ ...s, d: s.kind === 'perHero' ? '' : path(s, s.values) })))

const perHeroSeries = computed(() => scaled.value.filter(s => s.kind === 'perHero'))

// A hero's line colour: their player colour, or the team colour if none was given.
const heroColor = hr => hr.color ?? (hr.isRadiant ? RADIANT : DIRE)

// One line per hero for perHero series (Radiant's up and Dire's down in a split chart), each in the hero's
// player colour and its measure's line style.
const heroTracks = computed(() => perHeroSeries.value.flatMap(s => {
  return s.heroes.map(hr => {
    const side = hr.isRadiant ? 'radiant' : 'dire'
    const sign = normal.value || hr.isRadiant ? 1 : -1
    const last = hr.values.length - 1
    // Interpolated, so marks between data points sit on the line drawn between them.
    const at = t => valueBetween(hr.values, s.step, t)
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
      dash: lineStyle(s.key).dash,
      color: heroColor(hr),
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

// The value at time t on the straight line between the points either side, as the chart draws it; null
// past the last point.
function valueBetween(values, step, t) {
  const pos = t / step
  const i = Math.floor(pos)
  if (i >= values.length - 1) return i === values.length - 1 ? values[i] : null
  return values[i] + (values[i + 1] - values[i]) * (pos - i)
}

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

// Objective types switched off with their toggles (e.g. 'roshan').
const hiddenEvents = ref(new Set())
function toggleEventType(type) {
  const next = new Set(hiddenEvents.value)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  hiddenEvents.value = next
}

const eventsInRange = computed(() => props.events.filter(e => e.time >= 0 && e.time <= duration.value))

// Shown markers in the visible time range. One that would overlap the previous marker on its edge is nudged
// right so both stay readable.
const markers = computed(() => {
  // Right edge of the last marker placed on each side.
  const lastRight = { radiant: -Infinity, dire: -Infinity }
  return eventsInRange.value
    .filter(e => !hiddenEvents.value.has(e.type))
    .map(e => {
      const t = EVENT_TYPES[e.type]
      const cx = Math.max(x(e.time), lastRight[e.side] + t.w / 2 + 1)
      lastRight[e.side] = cx + t.w / 2
      const cy = e.side === 'radiant' ? PAD.t + t.h / 2 + 2 : h.value - PAD.b - t.h / 2 - 2
      return { ...e, cx, cy, ...t }
    })
})
// The objective types this chart has, shown or not: for the legend and the toggles.
const eventTypesShown = computed(() => Object.entries(EVENT_TYPES)
  .filter(([type]) => eventsInRange.value.some(e => e.type === type))
  .map(([type, t]) => ({ type, ...t })))

// The longest objective label on this chart, for the tooltip's invisible sizing row.
const widestEventLabel = computed(() => eventTypesShown.value
  .map(t => t.label)
  .reduce((a, b) => (b.length > a.length ? b : a), ''))

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
    // Highest first by the first measure shown (e.g. damage), as of the hovered moment.
    const sortKey = perHeroSeries.value[0]?.key
    const rows = [...heroes.values()].sort((a, b) => (b.cells[sortKey] ?? -Infinity) - (a.cells[sortKey] ?? -Infinity))
    const totals = perHeroSeries.value.map(s => {
      const sum = rows.reduce((acc, r) => acc + (r.cells[s.key] ?? 0), 0)
      return s.format ? s.format(sum) : compact(sum)
    })
    return { key: isRadiant ? 'radiant' : 'dire', label: isRadiant ? 'Radiant' : 'Dire', rows, totals }
  }).filter(sec => sec.rows.length)
})

// The tooltip sits right of the cursor, or left of it when it wouldn't fit, using its measured width
// (it keeps its natural width, so nothing is squeezed); either way it's kept inside the chart.
const tooltip = ref(null)
const tooltipWidth = ref(0)
// The widest the tooltip has been on this chart, used as its minimum so it never shrinks back as you move
// along (numbers change width from point to point). Reset when the columns change.
const tooltipMinWidth = ref(0)
watch(() => [props.series.map(s => s.key).join(), hiddenHeroes.value.size, width.value], () => { tooltipMinWidth.value = 0 })
let tooltipObserver = null
watch(tooltip, el => {
  tooltipObserver?.disconnect()
  if (!el) return
  tooltipObserver = new ResizeObserver(([entry]) => {
    const w = entry.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth
    tooltipWidth.value = w
    if (w > tooltipMinWidth.value) tooltipMinWidth.value = Math.ceil(w)
  })
  tooltipObserver.observe(el)
})
onBeforeUnmount(() => tooltipObserver?.disconnect())

const tooltipStyle = computed(() => {
  if (hover.value == null) return {}
  const px = x(hover.value)
  const w = tooltipWidth.value || 180
  const gap = 10
  const left = px + gap + w <= width.value ? px + gap : px - gap - w
  return { left: `${Math.max(0, Math.min(left, width.value - w))}px`, minWidth: tooltipMinWidth.value ? `${tooltipMinWidth.value}px` : null }
})

const heading = computed(() => (single.value ? props.series[0].label : props.title))

// From the shown series: a hero-built lead only has values once its shown heroes are summed.
const summary = computed(() => shown.value
  .map(s => {
    if (s.kind === 'perHero') {
      return `${s.label}: ${s.heroes.map(hr => `${hr.hero?.displayName ?? 'Hero'} ${compact(hr.values.at(-1) ?? 0)}`).join(', ')}`
    }
    if (!s.values?.length) return `${s.label}: no heroes shown`
    const end = s.values.at(-1) ?? 0
    return `${s.label}: ${display(s, end)} ${sideShort(s, end)} at ${formatTime((s.values.length - 1) * s.step)}`
  })
  .join('; '))
</script>

<template>
  <!-- While expanded, the chart moves to <body> so it sits above everything (inside the page it would be
       trapped under the sticky header by its container's stacking). The host leaves layout to the chart. -->
  <div class="chart-host">
  <Teleport to="body" :disabled="!expanded">
  <div ref="root" class="advantage-chart" :class="{ fill: filling, 'chart-expanded': expanded }">
    <!-- The page's controls for this chart (measure chips), with the expand button on the far right. -->
    <div class="chart-controls">
      <div class="chart-controls-slot"><slot name="controls" /></div>
      <button
        type="button"
        class="fullscreen-btn"
        :title="expanded ? 'Shrink (Esc)' : 'Expand to the window'"
        :aria-label="expanded ? 'Shrink chart' : 'Expand chart to fill the window'"
        :aria-pressed="expanded"
        @click="setExpanded(!expanded)"
      >
        <svg v-if="!expanded" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <!-- Expand: arrows pointing out to opposite corners. -->
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <!-- Minimize: arrows pointing in from opposite corners. -->
          <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
    <div class="chart-head">
      <span class="chart-title">
        {{ heading }}
      </span>
      <span class="legend">
        <!-- Per-hero charts are keyed by the hero toggles below; several measures get a line-style key here. -->
        <template v-if="normal">
          <template v-if="!single">
            <span v-for="s in series" :key="s.key" class="key">
              <LineKey v-if="s.kind === 'probability'" :dash="PROB_DASH" :color="s.color" />
              <LineKey v-else :dash="lineStyle(s.key).dash" color="var(--color-text)" />{{ s.label }}
            </span>
          </template>
        </template>
        <template v-else-if="single">
          <span class="key"><i :style="{ background: RADIANT }" />Radiant</span>
          <span class="key"><i :style="{ background: DIRE }" />Dire</span>
        </template>
        <template v-else>
          <span v-for="s in series" :key="s.key" class="key">
            <LineKey :dash="s.kind === 'probability' ? PROB_DASH : null" :color="s.color" />{{ s.label }}
          </span>
        </template>
        <span v-for="t in eventTypesShown" :key="t.type" class="key">
          <img :src="t.icon" class="key-icon" alt="" />{{ t.label }}
        </span>
      </span>
    </div>
    <div ref="body" class="chart-body" :style="filling ? { minHeight: `${height}px` } : null">
      <div v-if="emptyHint" class="empty-hint">{{ emptyHint }}</div>
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
        <template v-if="single && lines[0].kind !== 'perHero' && lines[0].values.length">
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
            :stroke-dasharray="l.kind === 'probability' ? PROB_DASH : null"
          />
        </template>
        <!-- Per-hero lines, labelled by the hero's icon where each ends. -->
        <path
          v-for="t in heroTracks"
          :key="t.key"
          :d="t.d"
          class="line"
          :stroke="t.color"
          :stroke-dasharray="t.dash"
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

      <div v-if="hover != null && (hoverRows.length || heroSections.length)" ref="tooltip" class="tooltip" :style="tooltipStyle">
        <div class="tt-time">{{ formatTime(hover) }}</div>
        <div v-if="widestEventLabel" class="tt-event tt-sizer" aria-hidden="true">
          <span class="key-icon" style="width: 19px" />
          <span class="tt-event-hero" />
          <span>{{ widestEventLabel }} · 00:00</span>
        </div>
        <div v-for="m in hoverEvents" :key="m.key" class="tt-event">
          <img :src="m.icon" class="key-icon" alt="" />
          <HeroIcon :hero="m.hero" class="tt-event-hero" />
          <span class="tt-event-text">{{ m.label }} · {{ formatTime(m.time) }}</span>
        </div>
        <div v-for="r in hoverRows" :key="r.s.key" class="tt-row">
          <LineKey :width="16" :dash="!single && r.s.kind === 'probability' ? PROB_DASH : null" :color="single ? sideColor(r.s, r.v) : r.s.color" />
          <strong>{{ display(r.s, r.v) }}</strong>
          <span>{{ r.s.label }} · {{ sideShort(r.s, r.v) }}</span>
          <small v-if="r.s.detail" class="tt-detail">{{ r.s.detail(hover) }}</small>
        </div>
        <!-- One grid for both teams, so every column lines up: measure names once, then per team a totals
             row (team name, its totals under each column) followed by its heroes. -->
        <div v-if="heroSections.length" class="tt-table" :style="{ '--cols': perHeroSeries.length }">
          <span />
          <span v-for="s in perHeroSeries" :key="s.key" class="tt-col">
            <LineKey v-if="!single" :width="16" :dash="lineStyle(s.key).dash" color="var(--color-text)" />{{ s.short ?? s.label }}
          </span>
          <template v-for="sec in heroSections" :key="sec.key">
            <span class="tt-side tt-sep tt-sum" :class="[`tt-side-${sec.key}`, `tt-sum-${sec.key}`]">{{ sec.label }}</span>
            <strong v-for="(total, i) in sec.totals" :key="i" class="tt-total tt-sep tt-sum" :class="`tt-sum-${sec.key}`">{{ total }}</strong>
            <template v-for="r in sec.rows" :key="r.key">
              <HeroIcon :hero="r.hero" class="tt-hero-icon" />
              <strong v-for="s in perHeroSeries" :key="s.key" class="tt-cell">
                {{ r.cells[s.key] == null ? '—' : s.format ? s.format(r.cells[s.key]) : compact(r.cells[s.key]) }}<small v-if="r.details[s.key]" class="tt-detail">{{ r.details[s.key] }}</small>
              </strong>
            </template>
          </template>
        </div>
      </div>
    </div>
    <div class="x-label">Minute</div>

    <!-- Per-hero charts: per side, a toggle for the whole side and one for each hero, to show or hide lines.
         The side emblems sit on the outside (Radiant left, Dire right) with a dot between the teams. -->
    <div v-if="toggleHeroes.length || eventTypesShown.length" class="hero-toggles" role="group" aria-label="Heroes and objectives shown">
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
          :class="[t.isRadiant ? 'toggle-radiant' : 'toggle-dire', { off: hiddenHeroes.has(t.key) }]"
          :aria-pressed="!hiddenHeroes.has(t.key)"
          :title="`${hiddenHeroes.has(t.key) ? 'Show' : 'Hide'} ${t.hero?.displayName ?? 'hero'}`"
          @click="toggleHero(t.key)"
        >
          <HeroIcon :hero="t.hero" class="hero-toggle-icon" />
          <!-- This hero's line colour. -->
          <span class="hero-key-line" aria-hidden="true">
            <i :style="{ color: heroKeyColor(t) }" />
          </span>
        </button>
      </div>
      </template>
      <!-- Objectives (Roshan, wisdom runes): show or hide their markers. -->
      <template v-if="eventTypesShown.length">
        <span v-if="toggleSides.length" class="team-dot" aria-hidden="true" />
        <div class="toggle-side">
          <button
            v-for="t in eventTypesShown"
            :key="t.type"
            type="button"
            class="hero-toggle event-toggle"
            :class="{ off: hiddenEvents.has(t.type) }"
            :aria-pressed="!hiddenEvents.has(t.type)"
            :title="`${hiddenEvents.has(t.type) ? 'Show' : 'Hide'} ${t.label} markers`"
            @click="toggleEventType(t.type)"
          >
            <img :src="t.icon" :alt="t.label" class="event-toggle-icon" />
          </button>
        </div>
      </template>
    </div>
  </div>
  </Teleport>
  </div>
</template>

<style scoped>
.chart-host { display: contents; }
.advantage-chart { position: relative; min-width: 0; }
.fullscreen-btn {
  display: inline-flex;
  padding: 0.2rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-muted, #7a8799);
  cursor: pointer;
}
.fullscreen-btn:hover { color: var(--color-text); background: rgba(255,255,255,.06); }
.fullscreen-btn:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }
/* Expanded: over the page (above the sticky header and sidebar), filling the window. */
.advantage-chart.chart-expanded {
  position: fixed;
  inset: 0;
  z-index: 900;
  height: auto;
  padding: 1.5rem 2rem;
  background: var(--color-bg, #0d0f12);
}
.chart-controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.chart-controls-slot { flex: 1; min-width: 0; }
.chart-controls-slot :deep(.chips) { margin-bottom: 0; }

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.3rem;
}
.chart-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--color-text);
}
.legend { display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; }
.key {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--fs-sm);
  color: var(--color-muted, #7a8799);
}
/* Same square as the lane breakdown's key. */
.key i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.chart-body { position: relative; }
.empty-hint {
  position: absolute;
  inset: 0 0 22px 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-sm);
  color: var(--color-muted, #7a8799);
  pointer-events: none;
  z-index: 1;
}
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
  font-size: var(--fs-xs);
  fill: var(--color-muted, #7a8799);
  font-variant-numeric: tabular-nums;
}
.crosshair { stroke: #7a8799; stroke-width: 1; shape-rendering: crispEdges; }
.hover-dot { stroke: var(--color-surface, #1a1f2b); stroke-width: 2; }

.x-label {
  text-align: center;
  font-size: var(--fs-xs);
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
.hero-toggle.off .hero-key-line i { color: var(--color-border, #2e3542) !important; }
.hero-toggle.off { opacity: 0.35; filter: grayscale(1); border-bottom-color: var(--color-border, #2e3542); }
.hero-toggle:hover { opacity: 1; }
.hero-toggle:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }
/* Objective toggles: the marker icon, centred in a hero-sized button. */
.hero-toggles .event-toggle { border-bottom-color: transparent; justify-content: center; align-items: center; width: 30px; height: 34px; }
.hero-toggle.event-toggle .event-toggle-icon { display: block; width: 20px; height: 20px; border-radius: 0; object-fit: contain; }
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
  /* Its natural width wherever it is, never squeezed by the chart's edge. */
  width: max-content;
  z-index: 5;
  font-variant-numeric: tabular-nums;
}
.tt-time {
  font-size: var(--fs-sm);
  color: var(--color-muted, #7a8799);
  margin-bottom: 0.2rem;
}
.tt-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--fs-sm);
  white-space: nowrap;
  /* Equal-width digits, so columns don't shift as the hovered values change. */
  font-variant-numeric: tabular-nums;
}
.tt-row strong { color: var(--color-text); font-weight: 700; min-width: 3.2rem; }
/* Level-up (or other) marks on a line, ringed in the surface colour so they read over other lines. */
.line-dot { stroke: var(--color-surface, #1a1f2b); stroke-width: 1; pointer-events: none; }
/* Supporting numbers beside a value, e.g. last hits/denies next to net worth. */
.tt-detail { margin-left: 0.3rem; font-size: var(--fs-sm); font-weight: 500; color: var(--color-muted, #7a8799); }
.tt-col { display: inline-flex; align-items: center; justify-content: flex-end; gap: 0.25rem; font-size: var(--fs-xs); color: var(--color-muted, #7a8799); }
/* The objective icons again, in the legend and tooltip. */
.key-icon { display: block; height: 14px; width: auto; }
.tt-event {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--fs-sm);
  color: var(--color-muted, #7a8799);
  white-space: nowrap;
  margin-bottom: 0.15rem;
}
/* An invisible copy of the widest objective row: it gives the tooltip that width from the start, so the
   real rows fit in full and the tooltip doesn't jump wider when one appears. */
.tt-sizer { height: 0; margin: 0; overflow: hidden; visibility: hidden; }
.tt-event :deep(img), .tt-event-hero { width: 18px; height: 18px; border-radius: 3px; object-fit: cover; }
/* Per-team table: a label/icon column, then one right-aligned column per measure. */
.tt-table {
  display: grid;
  grid-template-columns: auto repeat(var(--cols), minmax(2.6rem, auto));
  align-items: center;
  /* No column gap (it would break the totals band); cells are spaced with padding instead. */
  column-gap: 0;
  row-gap: 0.12rem;
  margin-top: 0.35rem;
  padding-top: 0.3rem;
  border-top: 1px solid #2e3542;
  font-size: var(--fs-sm);
  white-space: nowrap;
}
/* A team's totals row: a rule above, the team name in its colour, totals in bold. */
.tt-sep { margin-top: 0.3rem; padding-top: 0.25rem; border-top: 1px solid #2e3542; }
/* The totals row as a band: tinted in the team colour and underlined in it, apart from the heroes below. */
/* Fixed height with the contents centred, so the band never resizes with its numbers. */
.tt-sum {
  box-sizing: border-box;
  height: 1.7rem;
  display: flex;
  align-items: center;
  margin-bottom: 0.15rem;
  border-bottom: 1px solid;
  line-height: 1;
}
.tt-total.tt-sum { justify-content: flex-end; }
/* The rule above the band comes from .tt-sep; no extra top padding inside the fixed height. */
.tt-sep.tt-sum { padding-top: 0; }
.tt-sum-radiant { background: rgba(75,180,95,.1); border-bottom-color: rgba(75,180,95,.55); }
.tt-sum-dire { background: rgba(200,60,60,.1); border-bottom-color: rgba(200,60,60,.55); }
/* Same padding on every value column, so the band has clean ends and the numbers stay aligned. */
.tt-table .tt-col, .tt-total, .tt-cell { padding-left: 0.6rem; padding-right: 0.35rem; }
.tt-side.tt-sum { padding-left: 0.35rem; padding-right: 0.35rem; }
.tt-side {
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.tt-side-radiant { color: #4bb45f; }
.tt-side-dire { color: #c83c3c; }
.tt-total { text-align: right; font-weight: 800; color: var(--color-text); }
.tt-cell { text-align: right; font-weight: 600; color: var(--color-text); }
.tt-table :deep(img), .tt-hero-icon { display: block; width: 20px; height: 20px; border-radius: 3px; object-fit: cover; }
.tt-row span { color: var(--color-muted, #7a8799); }
</style>
