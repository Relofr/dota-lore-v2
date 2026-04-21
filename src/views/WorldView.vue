<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { locations } from '@/data/locations.js'
import { useHeroes, getHeroById } from '@/composables/useHeroes.js'

const { loading } = useHeroes()

const selectedType = ref('all')

const locationTypes = computed(() => {
  const types = new Set(locations.map((l) => l.type))
  return Array.from(types).sort()
})

const filteredLocations = computed(() => {
  if (selectedType.value === 'all') return locations
  return locations.filter((l) => l.type === selectedType.value)
})

function getHeroesForLocation(location) {
  return location.relatedHeroIds.map((id) => getHeroById(id)).filter(Boolean)
}
</script>

<template>
  <div class="world-view">
    <div class="page-header">
      <h1>The World</h1>
      <p class="page-desc">
        Locations, realms, and places of power across the Dota 2 universe — from mortal cities to
        planes of existence beyond the physical world.
      </p>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Type</label>
        <div class="filter-buttons">
          <button :class="{ active: selectedType === 'all' }" @click="selectedType = 'all'">All</button>
          <button
            v-for="type in locationTypes"
            :key="type"
            :class="{ active: selectedType === type }"
            @click="selectedType = type"
          >{{ type }}</button>
        </div>
      </div>
    </div>

    <p class="results-count">
      {{ filteredLocations.length }} location{{ filteredLocations.length !== 1 ? 's' : '' }}
    </p>

    <div class="locations-list">
      <article v-for="location in filteredLocations" :key="location.id" class="location-item">
        <div class="location-header">
          <div class="location-title-row">
            <h2 class="location-name">{{ location.name }}</h2>
            <span class="location-type-badge">{{ location.type }}</span>
          </div>
          <span class="location-region">{{ location.region }}</span>
        </div>

        <p class="location-short">{{ location.shortDescription }}</p>
        <p class="location-desc">{{ location.description }}</p>

        <div v-if="!loading && getHeroesForLocation(location).length" class="location-heroes">
          <span class="heroes-label">Related heroes:</span>
          <RouterLink
            v-for="hero in getHeroesForLocation(location)"
            :key="hero.id"
            :to="`/heroes/${hero.id}`"
            class="hero-chip"
          >{{ hero.name }}</RouterLink>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.world-view {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.page-header {
  margin-bottom: calc(var(--spacing-lg) * 1.5);
}

.page-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

.page-desc {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  max-width: 600px;
  margin: 0;
  line-height: 1.6;
}

.filters {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.filter-group label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  min-width: 40px;
}

.filter-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-buttons button {
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-buttons button:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.filter-buttons button.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #000;
}

.results-count {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-lg);
}

.locations-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.location-item {
  padding: var(--spacing-lg);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.location-header {
  margin-bottom: var(--spacing-sm);
}

.location-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.location-name {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.location-type-badge {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--color-tag-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.location-region {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.location-short {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin: 0 0 var(--spacing-md);
  line-height: 1.5;
}

.location-desc {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--color-text);
  margin: 0 0 var(--spacing-md);
}

.location-heroes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.heroes-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.hero-chip {
  font-size: 0.8rem;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(200, 151, 42, 0.1);
  color: var(--color-accent);
  text-decoration: none;
  border: 1px solid rgba(200, 151, 42, 0.2);
  transition: background 0.15s;
}

.hero-chip:hover {
  background: rgba(200, 151, 42, 0.2);
}
</style>
