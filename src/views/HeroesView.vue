<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHeroes, allRoles, allAttributes } from '@/composables/useHeroes.js'
import HeroCard from '@/components/HeroCard.vue'

const ATTR_ICONS = {
  strength:     'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_strength.png',
  agility:      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_agility.png',
  intelligence: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_intelligence.png',
  universal:    'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_universal.png',
}

const ATTR_LABELS = {
  strength: 'Strength',
  agility: 'Agility',
  intelligence: 'Intelligence',
  universal: 'Universal',
}

const route = useRoute()
const router = useRouter()
const { heroes, loading, error } = useHeroes()

const searchQuery = ref(route.query.q || '')
const selectedAttributes = ref(route.query.attr ? [].concat(route.query.attr) : [])
const selectedRoles = ref(route.query.role ? [].concat(route.query.role) : [])
const selectedFactions = ref(route.query.faction ? [].concat(route.query.faction) : [])

watch([searchQuery, selectedAttributes, selectedRoles, selectedFactions], () => {
  router.replace({
    query: {
      ...(searchQuery.value ? { q: searchQuery.value } : {}),
      ...(selectedAttributes.value.length ? { attr: selectedAttributes.value } : {}),
      ...(selectedRoles.value.length ? { role: selectedRoles.value } : {}),
      ...(selectedFactions.value.length ? { faction: selectedFactions.value } : {}),
    }
  })
}, { deep: true })

const allFactions = computed(() => {
  const seen = new Map()
  for (const hero of heroes.value) {
    if (hero.factionId && !seen.has(hero.factionId)) {
      seen.set(hero.factionId, hero.affiliation)
    }
  }
  return [...seen.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const filteredHeroes = computed(() => {
  return heroes.value.filter((hero) => {
    const q = searchQuery.value.toLowerCase()
    const matchesSearch =
      !q ||
      hero.name.toLowerCase().includes(q) ||
      (hero.realName && hero.realName.toLowerCase().includes(q)) ||
      (hero.lore && hero.lore.toLowerCase().includes(q)) ||
      hero.abilities.some(
        a => a.displayName.toLowerCase().includes(q) || a.lore.toLowerCase().includes(q),
      )

    const matchesAttribute =
      selectedAttributes.value.length === 0 ||
      selectedAttributes.value.includes(hero.primaryAttribute)

    const matchesRole =
      selectedRoles.value.length === 0 ||
      selectedRoles.value.every((role) => hero.roles.includes(role))

    const matchesFaction =
      selectedFactions.value.length === 0 ||
      selectedFactions.value.includes(hero.factionId)

    return matchesSearch && matchesAttribute && matchesRole && matchesFaction
  })
})

function toggleAttribute(attr) {
  const idx = selectedAttributes.value.indexOf(attr)
  if (idx >= 0) selectedAttributes.value.splice(idx, 1)
  else selectedAttributes.value.push(attr)
}

function toggleRole(role) {
  const idx = selectedRoles.value.indexOf(role)
  if (idx >= 0) selectedRoles.value.splice(idx, 1)
  else selectedRoles.value.push(role)
}

function toggleFaction(id) {
  const idx = selectedFactions.value.indexOf(id)
  if (idx >= 0) selectedFactions.value.splice(idx, 1)
  else selectedFactions.value.push(id)
}

function clearFilters() {
  searchQuery.value = ''
  selectedAttributes.value = []
  selectedRoles.value = []
  selectedFactions.value = []
}

const hasActiveFilters = computed(
  () => searchQuery.value || selectedAttributes.value.length || selectedRoles.value.length || selectedFactions.value.length,
)
</script>

<template>
  <div class="heroes-view">
    <div class="page-header">
      <h1>Heroes</h1>
      <p class="page-desc">
        <template v-if="loading">Loading heroes…</template>
        <template v-else-if="error">{{ error }}</template>
        <template v-else>
          {{ heroes.length }} heroes
        </template>
      </p>
    </div>

    <div class="filters">
      <div class="search-row">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M13 13L17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="Search heroes, abilities, lore…"
            :disabled="loading"
          />
        </div>
        <button v-if="hasActiveFilters" class="clear-btn" @click="clearFilters">Clear</button>
      </div>

      <div class="filter-row">
        <div class="attr-group">
          <button
            v-for="attr in allAttributes"
            :key="attr"
            :class="['attr-btn', `attr-${attr}`, { active: selectedAttributes.includes(attr) }]"
            :title="attr.charAt(0).toUpperCase() + attr.slice(1)"
            @click="toggleAttribute(attr)"
          >
            <img :src="ATTR_ICONS[attr]" :alt="attr" class="attr-icon" />
            <span>{{ ATTR_LABELS[attr] }}</span>
          </button>
        </div>

        <div class="filter-divider" />

        <div class="role-group">
          <button
            v-for="role in allRoles"
            :key="role"
            :class="['role-btn', { active: selectedRoles.includes(role) }]"
            @click="toggleRole(role)"
          >
            {{ role }}
          </button>
        </div>
      </div>

      <div v-if="allFactions.length" class="filter-row faction-row">
        <button
          v-for="faction in allFactions"
          :key="faction.id"
          :class="['faction-btn', { active: selectedFactions.includes(faction.id) }]"
          @click="toggleFaction(faction.id)"
        >
          {{ faction.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="skeleton-grid">
      <div v-for="n in 20" :key="n" class="skeleton-card" />
    </div>

    <div v-else-if="error" class="error-state">
      <p>Failed to load heroes</p>
    </div>

    <div v-else-if="filteredHeroes.length === 0" class="empty-state">
      <p>No heroes match your filters.</p>
      <button class="clear-btn" @click="clearFilters">Clear filters</button>
    </div>

    <div v-else>
      <p class="results-count">
        {{ filteredHeroes.length }} hero{{ filteredHeroes.length !== 1 ? 'es' : '' }}
      </p>
      <div class="hero-grid">
        <HeroCard v-for="hero in filteredHeroes" :key="hero.id" :hero="hero" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.heroes-view {
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
  font-size: 1.5rem;
  margin: 0;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: var(--spacing-lg);
}

/* Search row */
.search-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.search-wrap {
  position: relative;
  flex: 1;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 16px 0 38px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--color-accent);
}

.clear-btn {
  height: 42px;
  padding: 0 14px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.clear-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* Filter row */
.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.attr-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.attr-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.attr-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.attr-btn:hover {
  background: var(--color-tag-bg);
  color: var(--color-text);
}

.attr-btn.attr-strength.active  { background: #c83c3c22; border-color: #c83c3c; color: #e05555; }
.attr-btn.attr-agility.active   { background: #3ca05022; border-color: #3ca050; color: #4ebb65; }
.attr-btn.attr-intelligence.active { background: #3c64c822; border-color: #3c64c8; color: #5a80e0; }
.attr-btn.attr-universal.active { background: #8c50c822; border-color: #8c50c8; color: #a870e0; }

.filter-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
}

.role-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.role-btn {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.role-btn:hover {
  background: var(--color-tag-bg);
  color: var(--color-text);
}

.role-btn.active {
  background: var(--color-accent);
  color: #000;
  font-weight: 500;
}

.faction-row {
  flex-wrap: wrap;
}

.faction-btn {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.faction-btn:hover {
  background: var(--color-tag-bg);
  color: var(--color-text);
}

.faction-btn.active {
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-card-bg));
  border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
  color: var(--color-accent);
  font-weight: 500;
}

.results-count {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--spacing-md);
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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

.empty-state {
  text-align: center;
  padding: calc(var(--spacing-lg) * 2);
  color: var(--color-text-muted);
}

.error-state {
  text-align: center;
  padding: calc(var(--spacing-lg) * 2);
  color: #e05;
}
</style>
