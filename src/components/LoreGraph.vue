<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHeroes } from '@/composables/useHeroes.js'
import { factions, getFactionById } from '@/data/factions.js'

const props = defineProps({
  hero: { type: Object, required: true },
})

const router = useRouter()
const { heroes } = useHeroes()

const W = 640
const H = 400
const CX = W / 2
const CY = H / 2 - 10

const attributeColors = {
  strength: '#c83c3c',
  agility: '#3ca050',
  intelligence: '#3c64c8',
  universal: '#8c50c8',
}
const alignmentColors = {
  light: '#d4af37',
  dark: '#a855f7',
  neutral: '#6b7280',
}

function detectLoreMentions(lore, entityList) {
  if (!lore || !entityList.length) return new Set()
  const escaped = entityList
    .sort((a, b) => b.name.length - a.name.length)
    .map(e => e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const found = new Set()
  let match
  while ((match = pattern.exec(lore)) !== null) {
    const entity = entityList.find(e => e.name.toLowerCase() === match[0].toLowerCase())
    if (entity) found.add(entity.id)
  }
  return found
}

const surroundingNodes = computed(() => {
  const heroList = heroes.value
  if (!heroList.length) return []

  const heroEntities = heroList
    .filter(h => h.id !== props.hero.id)
    .flatMap(h => {
      const e = [{ id: h.id, name: h.name, type: 'hero' }]
      if (h.realName && h.realName !== h.name)
        e.push({ id: h.id, name: h.realName, type: 'hero' })
      return e
    })
  const factionEntities = factions.map(f => ({ id: f.id, name: f.name, type: 'faction' }))

  const loreMentioned = detectLoreMentions(props.hero.lore, [...heroEntities, ...factionEntities])

  const nodes = []
  const seen = new Set()

  // Explicit related heroes
  for (const id of props.hero.relatedHeroIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const h = heroList.find(h => h.id === id)
    if (!h) continue
    nodes.push({
      id,
      label: h.name,
      route: `/heroes/${h.id}`,
      iconUrl: h.iconUrl,
      type: 'hero',
      color: attributeColors[h.primaryAttribute] || '#888',
      link: loreMentioned.has(id) ? 'both' : 'related',
    })
    loreMentioned.delete(id)
  }

  // Faction
  if (props.hero.factionId) {
    const f = getFactionById(props.hero.factionId)
    if (f && !seen.has(f.id)) {
      seen.add(f.id)
      nodes.push({
        id: f.id,
        label: f.name,
        route: `/factions/${f.id}`,
        iconUrl: null,
        type: 'faction',
        color: alignmentColors[f.alignment] || '#888',
        link: loreMentioned.has(f.id) ? 'both' : 'faction',
      })
      loreMentioned.delete(f.id)
    }
  }

  // Lore-only mentions (cap at 6 to keep graph readable)
  let loreCount = 0
  for (const id of loreMentioned) {
    if (loreCount >= 6) break
    if (seen.has(id)) continue
    seen.add(id)
    const heroEntity = heroEntities.find(e => e.id === id)
    if (heroEntity) {
      const h = heroList.find(h => h.id === id)
      if (!h) continue
      nodes.push({
        id,
        label: h.name,
        route: `/heroes/${h.id}`,
        iconUrl: h.iconUrl,
        type: 'hero',
        color: attributeColors[h.primaryAttribute] || '#888',
        link: 'lore',
      })
    } else {
      const f = factions.find(f => f.id === id)
      if (!f) continue
      nodes.push({
        id,
        label: f.name,
        route: `/factions/${f.id}`,
        iconUrl: null,
        type: 'faction',
        color: alignmentColors[f.alignment] || '#888',
        link: 'lore',
      })
    }
    loreCount++
  }

  const n = nodes.length
  if (!n) return []
  const radius = Math.max(140, (n * 72) / (2 * Math.PI))
  const startAngle = -Math.PI / 2

  return nodes.map((node, i) => {
    const angle = startAngle + (i / n) * 2 * Math.PI
    return {
      ...node,
      x: CX + radius * Math.cos(angle),
      y: CY + radius * Math.sin(angle),
    }
  })
})

const centerColor = computed(() => attributeColors[props.hero.primaryAttribute] || '#888')

function truncate(str, max = 14) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}
</script>

<template>
  <div v-if="surroundingNodes.length" class="graph-wrap">
    <svg
      class="graph-svg"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="lg-clip-center">
          <circle :cx="CX" :cy="CY" r="44" />
        </clipPath>
        <clipPath
          v-for="n in surroundingNodes"
          :id="`lg-clip-${n.id}`"
          :key="`clip-${n.id}`"
        >
          <circle :cx="n.x" :cy="n.y" r="24" />
        </clipPath>
        <filter id="lg-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Edges -->
      <line
        v-for="n in surroundingNodes"
        :key="`edge-${n.id}`"
        :x1="CX" :y1="CY"
        :x2="n.x" :y2="n.y"
        :stroke="n.color"
        :stroke-width="n.link === 'lore' ? 1 : 1.5"
        :stroke-dasharray="n.link === 'lore' ? '5 4' : 'none'"
        :opacity="n.link === 'lore' ? 0.25 : 0.45"
      />

      <!-- Surrounding nodes -->
      <g
        v-for="n in surroundingNodes"
        :key="n.id"
        class="s-node"
        @click="router.push(n.route)"
      >
        <!-- Glow ring for strong connections -->
        <circle
          v-if="n.link !== 'lore'"
          :cx="n.x" :cy="n.y"
          r="29"
          :fill="n.color + '18'"
          filter="url(#lg-glow)"
        />
        <circle
          :cx="n.x" :cy="n.y"
          r="26"
          :fill="n.color + '22'"
          :stroke="n.color"
          :stroke-width="n.link === 'lore' ? 1 : 1.5"
          :stroke-dasharray="n.link === 'lore' ? '4 3' : 'none'"
          :opacity="n.link === 'lore' ? 0.6 : 1"
          class="s-circle"
        />
        <image
          v-if="n.iconUrl"
          :href="n.iconUrl"
          :x="n.x - 24" :y="n.y - 24"
          width="48" height="48"
          :clip-path="`url(#lg-clip-${n.id})`"
          preserveAspectRatio="xMidYMid slice"
          :opacity="n.link === 'lore' ? 0.55 : 1"
        />
        <text
          v-else
          :x="n.x" :y="n.y + 4"
          text-anchor="middle"
          :fill="n.color"
          font-size="13"
          font-weight="700"
        >{{ n.label.charAt(0) }}</text>
        <text
          :x="n.x"
          :y="n.y + 38"
          text-anchor="middle"
          class="s-label"
          :opacity="n.link === 'lore' ? 0.5 : 0.8"
        >{{ truncate(n.label) }}</text>
      </g>

      <!-- Center node -->
      <circle
        :cx="CX" :cy="CY"
        r="52"
        :fill="centerColor + '18'"
        filter="url(#lg-glow)"
      />
      <circle
        :cx="CX" :cy="CY"
        r="46"
        :fill="centerColor + '22'"
        :stroke="centerColor"
        stroke-width="2"
      />
      <image
        v-if="hero.iconUrl"
        :href="hero.iconUrl"
        :x="CX - 44" :y="CY - 44"
        width="88" height="88"
        clip-path="url(#lg-clip-center)"
        preserveAspectRatio="xMidYMid slice"
      />
      <text
        :x="CX" :y="CY + 60"
        text-anchor="middle"
        class="c-label"
      >{{ hero.name }}</text>
    </svg>

    <div class="legend">
      <span class="legend-item">
        <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" stroke-width="1.5" /></svg>
        Related
      </span>
      <span class="legend-item">
        <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" /></svg>
        Mentioned in lore
      </span>
    </div>
  </div>
</template>

<style scoped>
.graph-wrap {
  width: 100%;
}

.graph-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.s-node {
  cursor: pointer;
}

.s-node .s-circle {
  transition: filter 0.15s, opacity 0.15s;
}

.s-node:hover .s-circle {
  filter: brightness(1.4);
}

.s-label {
  font-size: 10px;
  fill: var(--color-text-muted);
  pointer-events: none;
}

.c-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--color-text);
  pointer-events: none;
}

.legend {
  display: flex;
  justify-content: center;
  gap: var(--spacing-lg);
  margin-top: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
</style>
