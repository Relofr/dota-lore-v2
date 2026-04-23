<script setup>
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useHeroes } from '@/composables/useHeroes.js'

const props = defineProps({
  lore: { type: String, required: true },
  heroId: { type: String, default: null },
})

const { heroes } = useHeroes()
const activeKey = ref(null) // "paraIdx-segIdx"

const attrLabel = {
  strength: 'Strength',
  agility: 'Agility',
  intelligence: 'Intelligence',
  universal: 'Universal',
}

const entities = computed(() => {
  const list = []

  for (const hero of heroes.value) {
    if (hero.id === props.heroId) continue
    list.push({
      type: 'hero',
      name: hero.name,
      displayName: hero.name,
      route: `/heroes/${hero.id}`,
      entityId: hero.id,
      iconUrl: hero.iconUrl,
    })
    if (hero.realName && hero.realName !== hero.name) {
      list.push({
        type: 'hero',
        name: hero.realName,
        displayName: hero.name,
        route: `/heroes/${hero.id}`,
        entityId: hero.id,
        iconUrl: hero.iconUrl,
      })
    }
  }

  const seenFactions = new Map()
  for (const hero of heroes.value) {
    if (hero.factionId && hero.affiliation && !seenFactions.has(hero.factionId)) {
      seenFactions.set(hero.factionId, hero.affiliation)
    }
  }
  for (const [factionId, affiliation] of seenFactions) {
    list.push({
      type: 'faction',
      name: affiliation,
      displayName: affiliation,
      route: `/heroes?faction=${factionId}`,
      entityId: factionId,
      iconUrl: null,
    })
  }

  return list.sort((a, b) => b.name.length - a.name.length)
})

function getSegments(text) {
  if (!text || entities.value.length === 0) {
    return [{ type: 'text', content: text }]
  }
  const escaped = entities.value.map(e =>
    e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const result = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const entity = entities.value.find(
      e => e.name.toLowerCase() === match[0].toLowerCase()
    )
    result.push({ type: 'link', content: match[0], route: entity.route, entity })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return result
}

const paragraphs = computed(() =>
  props.lore
    ? props.lore.split(/\n+/).filter(p => p.trim()).map(p => getSegments(p.trim()))
    : []
)
</script>

<template>
  <div class="lore-body">
    <p v-for="(segs, pi) in paragraphs" :key="pi" class="lore-text">
      <template v-for="(seg, si) in segs" :key="si">
        <span
          v-if="seg.type === 'link'"
          class="lore-entity"
          @mouseenter="activeKey = `${pi}-${si}`"
          @mouseleave="activeKey = null"
        >
          <RouterLink
            :to="seg.route"
            :class="['lore-link', seg.entity.type === 'faction' ? 'lore-link-faction' : '']"
          >{{ seg.content }}</RouterLink>
          <span v-if="activeKey === `${pi}-${si}`" class="entity-tooltip">
            <span class="tooltip-header">
              <img
                v-if="seg.entity.iconUrl"
                :src="seg.entity.iconUrl"
                class="tooltip-icon"
                alt=""
              />
              <span class="tooltip-name">{{ seg.entity.displayName }}</span>
            </span>
            <span v-if="seg.entity.type === 'faction'" class="tooltip-type">Faction</span>
          </span>
        </span>
        <template v-else>{{ seg.content }}</template>
      </template>
    </p>
  </div>
</template>

<style scoped>
.lore-text {
  font-size: 1rem;
  line-height: 1.8;
  color: var(--color-text);
  margin: 0;
}

.lore-text + .lore-text {
  margin-top: 1em;
}

.lore-entity {
  position: relative;
  display: inline-block;
  vertical-align: baseline;
}

.lore-link {
  color: var(--color-accent);
  text-decoration: none;
  border-bottom: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
  transition: border-color 0.15s;
}

.lore-link:hover {
  border-bottom-color: var(--color-accent);
}

.lore-link-faction {
  color: #7ec8c8;
  border-bottom-color: color-mix(in srgb, #7ec8c8 40%, transparent);
}

.lore-link-faction:hover {
  border-bottom-color: #7ec8c8;
}

.entity-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #252b36;
  border: 1px solid #2e3542;
  border-radius: var(--radius);
  padding: 8px 12px;
  min-width: 120px;
  max-width: 240px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tooltip-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tooltip-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text);
}

.tooltip-reason {
  font-size: 0.75rem;
  color: var(--color-accent);
  font-style: italic;
}

.tooltip-type {
  font-size: 0.72rem;
  color: #7ec8c8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tooltip-attr {
  font-size: 0.72rem;
  color: #9aa3b2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
