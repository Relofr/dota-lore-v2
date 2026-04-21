<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getFactionById } from '@/data/factions.js'
import { useHeroes, getHeroById } from '@/composables/useHeroes.js'
import { getLocationById } from '@/data/locations.js'
import HeroCard from '@/components/HeroCard.vue'
import FactionCard from '@/components/FactionCard.vue'

const route = useRoute()
const { loading } = useHeroes()

const faction = computed(() => getFactionById(route.params.id))
const memberHeroes = computed(() =>
  faction.value ? faction.value.memberIds.map((id) => getHeroById(id)).filter(Boolean) : [],
)
const relatedFactions = computed(() =>
  faction.value
    ? faction.value.relatedFactionIds.map((id) => getFactionById(id)).filter(Boolean)
    : [],
)
const location = computed(() =>
  faction.value?.locationId ? getLocationById(faction.value.locationId) : null,
)

const alignmentColors = {
  light: '#d4af37',
  dark: '#a855f7',
  neutral: '#888',
}
const alignmentLabels = { light: 'Light', dark: 'Dark', neutral: 'Neutral' }
</script>

<template>
  <div v-if="!faction" class="not-found">
    <p>Faction not found.</p>
    <RouterLink to="/factions">← Back to Factions</RouterLink>
  </div>

  <div v-else class="faction-detail">
    <div class="detail-inner">
      <nav class="breadcrumb">
        <RouterLink to="/factions">Factions</RouterLink>
        <span>→</span>
        <span>{{ faction.name }}</span>
      </nav>

      <div class="faction-header">
        <div class="header-meta">
          <div
            class="alignment-badge"
            :style="{
              color: alignmentColors[faction.alignment],
              background: alignmentColors[faction.alignment] + '18',
              borderColor: alignmentColors[faction.alignment] + '44',
            }"
          >{{ alignmentLabels[faction.alignment] }}</div>
          <span class="faction-type">{{ faction.type }}</span>
        </div>
        <h1>{{ faction.name }}</h1>
        <p class="short-desc">{{ faction.shortDescription }}</p>
      </div>

      <div class="desc-section">
        <h2>Overview</h2>
        <p class="desc-text">{{ faction.description }}</p>
      </div>

      <div v-if="location" class="location-section">
        <h2>Home Territory</h2>
        <RouterLink to="/world" class="location-link">
          <div class="location-card">
            <span class="location-name">{{ location.name }}</span>
            <span class="location-type">{{ location.type }}</span>
          </div>
        </RouterLink>
      </div>

      <div v-if="faction.memberIds.length" class="members-section">
        <h2>Heroes</h2>
        <div v-if="loading" class="skeleton-grid">
          <div v-for="n in faction.memberIds.length" :key="n" class="skeleton-card" />
        </div>
        <div v-else-if="memberHeroes.length" class="hero-grid">
          <HeroCard v-for="hero in memberHeroes" :key="hero.id" :hero="hero" />
        </div>
        <p v-else class="loading-note">Hero data loading…</p>
      </div>

      <div v-if="relatedFactions.length" class="related-section">
        <h2>Related Factions</h2>
        <div class="faction-grid">
          <FactionCard v-for="related in relatedFactions" :key="related.id" :faction="related" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.faction-detail {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.detail-inner {
  max-width: 760px;
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

.faction-header {
  margin-bottom: calc(var(--spacing-lg) * 1.5);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.alignment-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid;
}

.faction-type {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.faction-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

.short-desc {
  font-size: 1rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.desc-section,
.location-section,
.members-section,
.related-section {
  margin-bottom: calc(var(--spacing-lg) * 1.5);
}

.desc-section h2,
.location-section h2,
.members-section h2,
.related-section h2 {
  font-size: 0.8rem;
  font-weight: 600;
  margin: 0 0 var(--spacing-md);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
}

.desc-text {
  font-size: 1rem;
  line-height: 1.8;
  color: var(--color-text);
  margin: 0;
}

.location-link {
  text-decoration: none;
  color: inherit;
}

.location-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  transition: border-color 0.2s;
}

.location-link:hover .location-card {
  border-color: var(--color-accent);
}

.location-name {
  font-weight: 600;
  color: var(--color-text);
}

.location-type {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--spacing-md);
}

.faction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--spacing-md);
}

.skeleton-card {
  height: 240px;
  border-radius: var(--radius);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-style: italic;
}
</style>
