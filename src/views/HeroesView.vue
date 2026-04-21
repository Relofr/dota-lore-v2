<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHeroes, allRoles, allAttributes } from '@/composables/useHeroes.js'
import HeroCard from '@/components/HeroCard.vue'

const route = useRoute()
const router = useRouter()
const { heroes, loading, error } = useHeroes()

const searchQuery = ref(route.query.q || '')
const selectedAttributes = ref(route.query.attr ? [].concat(route.query.attr) : [])
const selectedRoles = ref(route.query.role ? [].concat(route.query.role) : [])

watch([searchQuery, selectedAttributes, selectedRoles], () => {
  router.replace({
    query: {
      ...(searchQuery.value ? { q: searchQuery.value } : {}),
      ...(selectedAttributes.value.length ? { attr: selectedAttributes.value } : {}),
      ...(selectedRoles.value.length ? { role: selectedRoles.value } : {}),
    }
  })
}, { deep: true })

const filteredHeroes = computed(() => {
  return heroes.value.filter((hero) => {
    const q = searchQuery.value.toLowerCase()
    const matchesSearch =
      !q ||
      hero.name.toLowerCase().includes(q) ||
      (hero.realName && hero.realName.toLowerCase().includes(q)) ||
      (hero.lore && hero.lore.toLowerCase().includes(q))

    const matchesAttribute =
      selectedAttributes.value.length === 0 ||
      selectedAttributes.value.includes(hero.primaryAttribute)

    const matchesRole =
      selectedRoles.value.length === 0 ||
      selectedRoles.value.every((role) => hero.roles.includes(role))

    return matchesSearch && matchesAttribute && matchesRole
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

function clearFilters() {
  searchQuery.value = ''
  selectedAttributes.value = []
  selectedRoles.value = []
}

const hasActiveFilters = computed(
  () => searchQuery.value || selectedAttributes.value.length || selectedRoles.value.length,
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
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Search by name or lore…"
        :disabled="loading"
      />

      <div class="filter-group">
        <label>Attribute</label>
        <div class="filter-buttons">
          <button
            v-for="attr in allAttributes"
            :key="attr"
            :class="['attr-btn', `attr-${attr}`, { active: selectedAttributes.includes(attr) }]"
            @click="toggleAttribute(attr)"
          >
            {{ attr.charAt(0).toUpperCase() + attr.slice(1) }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label>Role</label>
        <div class="filter-buttons">
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

      <div v-if="hasActiveFilters" class="filter-actions">
        <button class="clear-btn" @click="clearFilters">Clear all filters</button>
        <span class="active-summary">
          <template v-if="selectedAttributes.length">
            {{ selectedAttributes.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ') }}
          </template>
          <template v-if="selectedAttributes.length && selectedRoles.length"> · </template>
          <template v-if="selectedRoles.length">
            {{ selectedRoles.join(', ') }}
          </template>
        </span>
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
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.search-input {
  width: 100%;
  height: 40px;
  padding: 0 16px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--btn-radius);
  color: var(--color-text);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--color-accent);
}

.filter-group {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.filter-group label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  min-width: 60px;
  padding-top: 5px;
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
  user-select: none;
}

.filter-buttons button:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

/* Attribute active states */
.attr-btn.attr-strength.active  { background: #c83c3c; border-color: #c83c3c; color: #fff; }
.attr-btn.attr-agility.active   { background: #3ca050; border-color: #3ca050; color: #fff; }
.attr-btn.attr-intelligence.active { background: #3c64c8; border-color: #3c64c8; color: #fff; }
.attr-btn.attr-universal.active { background: #8c50c8; border-color: #8c50c8; color: #fff; }

/* Role active state */
.role-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #000;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
}

.clear-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
  white-space: nowrap;
}

.clear-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-text);
}

.active-summary {
  font-size: 0.8rem;
  color: var(--color-text-muted);
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
