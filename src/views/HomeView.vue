<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useHeroes } from '@/composables/useHeroes.js'
import HeroCard from '@/components/HeroCard.vue'

const { heroes, loading } = useHeroes()

const featuredHeroes = computed(() => {
  if (heroes.value.length <= 5) return heroes.value
  const shuffled = [...heroes.value].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 5)
})
</script>

<template>
  <div class="home">
    <section class="hero-banner">
      <div class="banner-content">
        <p class="banner-eyebrow">The Lore of</p>
        <h1 class="banner-title">Dota 2</h1>
        <div class="banner-actions">
          <RouterLink to="/heroes" class="btn btn-primary">Explore Heroes</RouterLink>
        </div>
      </div>
    </section>

    <section class="content-section">
      <div class="section-header">
        <h2>The Conflict</h2>
        <p>
          At the heart of the Dota 2 universe lies an ancient war between two primordial forces —
          the Radiant and the Dire. These are not simply armies but
          ancient cosmic entities, each exerting a pull on the warriors who fight in their names.
          Between them lies a battlefield that has been contested for longer than any civilization
          has existed.
        </p>
        <p>
          The heroes who fight in this conflict come from every corner of the world: gods stripped of
          their divinity, demons cast out of hell, knights merged with dragons, assassins of dead
          gods, and cosmic beings who predate creation itself. Each carries a story that stretches
          far beyond the battlefield.
        </p>
      </div>
    </section>

    <section class="content-section">
      <div class="section-header">
        <h2>Heroes</h2>
        <RouterLink to="/heroes" class="section-link">View all heroes →</RouterLink>
      </div>

      <div v-if="loading" class="skeleton-grid">
        <div v-for="n in 5" :key="n" class="skeleton-card" />
      </div>
      <div v-else class="hero-grid">
        <HeroCard v-for="hero in featuredHeroes" :key="hero.id" :hero="hero" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
}

.hero-banner {
  padding: calc(var(--spacing-lg) * 3) 0 calc(var(--spacing-lg) * 2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: calc(var(--spacing-lg) * 2);
}

.banner-eyebrow {
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin: 0 0 var(--spacing-sm);
}

.banner-title {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-family: "Reaver Bold";
  text-transform: uppercase;
  letter-spacing: -0.02em;
  margin: 0 0 var(--spacing-md);
  line-height: 1.1;
  color: var(--color-text);
}

.banner-subtitle {
  font-size: 1.15rem;
  color: var(--color-text-muted);
  max-width: 520px;
  margin: 0 0 calc(var(--spacing-lg) * 1.5);
  line-height: 1.6;
}

.banner-actions {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 10px 24px;
  border-radius: var(--btn-radius);
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.85;
}

.btn-primary {
  background: var(--color-accent);
  color: #000;
}

.btn-secondary {
  background: transparent;
  color: var(--color-text);
  border: 2px solid #ffffff50;
}

.content-section {
  margin-bottom: calc(var(--spacing-lg) * 2.5);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-lg);
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.section-header h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}

.section-header p {
  flex: 1 1 100%;
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.7;
  margin: var(--spacing-sm) 0 0;
}

.section-header a:not(.section-link) {
  color: var(--color-accent);
}

.section-link {
  color: var(--color-accent);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.faction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--spacing-md);
}

.skeleton-card {
  height: 260px;
  border-radius: var(--radius);
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.world-teaser {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.7;
  max-width: 700px;
  margin: 0;
}
</style>
