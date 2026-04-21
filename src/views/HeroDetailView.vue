<script setup>
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useHeroes } from "@/composables/useHeroes.js";
import LoreText from "@/components/LoreText.vue";

import meleeIcon   from "@/assets/images/melee.svg";
import rangedIcon  from "@/assets/images/ranged.svg";
import attackIcon  from "@/assets/images/attack.svg";
import defenseIcon from "@/assets/images/defense.svg";
import mobilityIcon from "@/assets/images/mobility.svg";

const route = useRoute();
const { heroes, loading } = useHeroes();

const hero = computed(
  () => heroes.value.find((h) => h.id === route.params.id) || null,
);

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g

function getExcerpt(loreText, name) {
  const re = new RegExp(`\\b${name.replace(ESCAPE_RE, '\\$&')}\\b`, 'i')
  const flat = loreText.replace(/\n/g, ' ')
  const match = re.exec(flat)
  if (!match) return null

  const idx = match.index
  const half = 80
  const start = Math.max(0, idx - half)
  const end = Math.min(flat.length, idx + match[0].length + half)

  const before = (start > 0 ? '…' : '') + flat.slice(start, idx)
  const after  = flat.slice(idx + match[0].length, end) + (end < flat.length ? '…' : '')

  return { before, match: match[0], after }
}

const relatedHeroes = computed(() => {
  if (!hero.value) return []
  const results = []
  const loreText = hero.value.lore || ''

  const currentNames = [hero.value.name]
  if (hero.value.realName && hero.value.realName !== hero.value.name)
    currentNames.push(hero.value.realName)

  for (const other of heroes.value) {
    if (other.id === hero.value.id) continue

    const otherNames = [other.name]
    if (other.realName && other.realName !== other.name) otherNames.push(other.realName)

    // Forward: this hero's lore mentions the other hero
    const forwardMatch = otherNames.find(n =>
      new RegExp(`\\b${n.replace(ESCAPE_RE, '\\$&')}\\b`, 'i').test(loreText)
    )
    if (forwardMatch) {
      results.push({ hero: other, excerpt: getExcerpt(loreText, forwardMatch) })
      continue
    }

    // Reverse: the other hero's lore mentions this hero
    const otherLore = other.lore || ''
    const reverseMatch = currentNames.find(n =>
      new RegExp(`\\b${n.replace(ESCAPE_RE, '\\$&')}\\b`, 'i').test(otherLore)
    )
    if (reverseMatch) {
      results.push({ hero: other, excerpt: getExcerpt(otherLore, reverseMatch) })
    }
  }

  return results
})

const attributeColors = {
  strength: "#c83c3c",
  agility: "#3ca050",
  intelligence: "#3c64c8",
  universal: "#8c50c8",
};

function fmt(n, decimals = 0) {
  return typeof n === 'number' ? +n.toFixed(decimals) : n
}

</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="loading-state">
    <div class="skeleton-header" />
    <div class="skeleton-body" />
  </div>

  <!-- Not found (heroes loaded but no match) -->
  <div v-else-if="!hero" class="not-found">
    <p>Hero not found.</p>
    <RouterLink to="/heroes">← Back to Heroes</RouterLink>
  </div>

  <!-- Hero detail -->
  <div v-else class="hero-detail">
    <nav class="breadcrumb">
      <RouterLink to="/heroes">Heroes</RouterLink>
      <span>→</span>
      <span>{{ hero.name }}</span>
    </nav>

    <div class="hero-header">
      <div class="hero-meta">
        <h1 class="hero-title">{{ hero.name }}</h1>
        <p v-if="hero.realName !== hero.name" class="hero-real-name">
          <em>{{ hero.realName }}</em>
        </p>
        <div class="meta-row">
          <span
            class="attribute-badge"
            :style="{
              background: attributeColors[hero.primaryAttribute] + '22',
              color: attributeColors[hero.primaryAttribute],
              borderColor: attributeColors[hero.primaryAttribute] + '55',
            }"
          >{{
            hero.primaryAttribute.charAt(0).toUpperCase() +
            hero.primaryAttribute.slice(1)
          }}</span>
          <span v-if="hero.attackType" class="attack-badge">{{ hero.attackType }}</span>
          <span v-for="role in hero.roles" :key="role" class="role-tag">{{ role }}</span>
        </div>
      </div>
    </div>

    <!-- Single flex row: all content left, portrait sticky right -->
    <div class="hero-layout">
      <div class="hero-content">
        <div v-if="hero.lore" class="lore-section">
          <h2>Lore</h2>
          <LoreText :lore="hero.lore" :hero-id="hero.id" />
        </div>
        <div v-else class="lore-section lore-empty">
          <h2>Lore</h2>
          <p class="lore-placeholder">Extended lore for {{ hero.name }} coming soon.</p>
        </div>

        <div v-if="relatedHeroes.length" class="related-section">
          <h2>Related Heroes</h2>
          <div class="related-chips">
            <RouterLink
              v-for="rel in relatedHeroes"
              :key="rel.hero.id"
              :to="`/heroes/${rel.hero.id}`"
              class="related-chip"
            >
              <img :src="rel.hero.iconUrl" :alt="rel.hero.name" class="related-chip-icon" />
              <span class="related-chip-name">{{ rel.hero.name }}</span>
            </RouterLink>
          </div>
        </div>

        <div v-if="hero.abilities && hero.abilities.length" class="abilities-section">
          <h2>Abilities</h2>
          <div class="ability-list">
            <div v-for="ab in hero.abilities" :key="ab.id" class="ability-item">
              <div class="ability-header">
                <img class="ability-icon" :src="ab.iconUrl" :alt="ab.displayName" />
                <h3 class="ability-name">{{ ab.displayName }}</h3>
              </div>
              <div class="ability-lore-wrap">
                <LoreText :lore="ab.lore" :hero-id="hero.id" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="hero-portrait-wrap">
        <video
          :key="hero.id"
          class="hero-portrait-img"
          :poster="`https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${hero.id}.png`"
          autoplay
          preload="auto"
          loop
          playsinline
        >
          <source
            type="video/webm"
            :src="`https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${hero.id}.webm`"
          />
        </video>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  /* max-width: 760px; */
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.skeleton-header {
  height: 120px;
  border-radius: var(--radius);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-body {
  height: 300px;
  border-radius: var(--radius);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.not-found {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: calc(var(--spacing-lg) * 2) var(--spacing-lg);
  text-align: center;
  color: var(--color-text-muted);
}

.not-found a {
  color: var(--color-accent);
  text-decoration: none;
}

.hero-detail {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.detail-inner {
  max-width: 680px;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-lg);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.breadcrumb a {
  color: var(--color-accent);
  text-decoration: none;
}

.hero-header {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: calc(var(--spacing-lg) * 1.5);
  align-items: flex-start;
}

.hero-layout {
  /* block — content flows left, portrait is fixed out of flow */
}

.hero-content {
  max-width: 680px;
}

.hero-portrait-wrap {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;
}

.hero-portrait-img {
  width: 60%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: auto;
}

@media (max-width: 900px) {
  .hero-layout {
    display: flex;
    flex-direction: column;
  }

  .hero-content {
    max-width: 100%;
    order: 2;
  }

  .hero-portrait-wrap {
    position: static;
    width: 100%;
    height: 60vw;
    pointer-events: auto;
    order: 1;
  }

  .hero-portrait-img {
    max-height: 100%;
  }
}

.hero-meta {
  flex: 1;
}

.hero-title {
  font-size: clamp(1.8rem, 4vw, 3.5rem);
  font-weight: 700;
  margin: 0 0 4px;
}

.hero-real-name {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  margin: 0 0 var(--spacing-md);
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--spacing-sm);
}

.attribute-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid;
  border-radius: 999px;
}

.role-tag {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 4px;
  background: var(--color-tag-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}

.attack-badge {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-tag-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.attack-type-icon {
  width: 14px;
  height: 14px;
}

.complexity-badge {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-tag-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  display: inline-flex;
  align-items: center;
}

/* Stats section */
.stats-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: calc(var(--spacing-lg) * 1.5);
}

.lore-section,
.related-section,
.abilities-section {
  margin-bottom: calc(var(--spacing-lg) * 1.5);
}

.lore-section h2,
.related-section h2,
.abilities-section h2 {
  font-size: 0.8rem;
  font-weight: 600;
  margin: 0 0 var(--spacing-md);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
}

.ability-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.ability-item {
  padding: var(--spacing-md);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.ability-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.ability-icon {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: cover;
  background: var(--color-border);
}

.ability-name {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
  font-family: "Reaver Bold";
}

.ability-lore-wrap :deep(.lore-text) {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  font-style: italic;
}

.ability-lore-wrap :deep(.lore-text + .lore-text) {
  margin-top: 0.5em;
}

.lore-placeholder {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0;
}

.related-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.related-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  text-decoration: none;
  color: var(--color-text);
  font-size: 0.78rem;
  transition: border-color 0.15s, background 0.15s;
}

.related-chip:hover {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-card-bg));
}

.related-chip-icon {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

.related-chip-name {
  white-space: nowrap;
}
</style>
