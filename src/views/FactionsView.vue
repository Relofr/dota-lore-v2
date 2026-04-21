<script setup>
import { ref, computed } from 'vue'
import { factions } from '@/data/factions.js'
import FactionCard from '@/components/FactionCard.vue'

const selectedAlignment = ref('all')

const filteredFactions = computed(() => {
  if (selectedAlignment.value === 'all') return factions
  return factions.filter((f) => f.alignment === selectedAlignment.value)
})
</script>

<template>
  <div class="factions-view">
    <div class="page-header">
      <h1>Factions</h1>
      <p class="page-desc">
        The powers, orders, and civilizations shaping the Dota 2 world.
      </p>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label>Alignment</label>
        <div class="filter-buttons">
          <button :class="{ active: selectedAlignment === 'all' }" @click="selectedAlignment = 'all'">All</button>
          <button :class="{ active: selectedAlignment === 'light', 'align-light': true }" @click="selectedAlignment = 'light'">Light</button>
          <button :class="{ active: selectedAlignment === 'neutral', 'align-neutral': true }" @click="selectedAlignment = 'neutral'">Neutral</button>
          <button :class="{ active: selectedAlignment === 'dark', 'align-dark': true }" @click="selectedAlignment = 'dark'">Dark</button>
        </div>
      </div>
    </div>

    <p class="results-count">{{ filteredFactions.length }} faction{{ filteredFactions.length !== 1 ? 's' : '' }}</p>

    <div class="factions-grid">
      <FactionCard v-for="faction in filteredFactions" :key="faction.id" :faction="faction" />
    </div>
  </div>
</template>

<style scoped>
.factions-view {
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
  margin: 0;
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
  min-width: 70px;
}

.filter-buttons {
  display: flex;
  gap: 6px;
}

.filter-buttons button {
  padding: 4px 14px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.82rem;
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

.filter-buttons button.align-light.active {
  background: #d4af37;
  border-color: #d4af37;
  color: #000;
}

.filter-buttons button.align-dark.active {
  background: #a855f7;
  border-color: #a855f7;
  color: #fff;
}

.results-count {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md);
}

.factions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}
</style>
