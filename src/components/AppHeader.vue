<script setup>
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <RouterLink to="/" class="site-logo">
        <span class="logo-text">DOTA 2</span>
        <span class="logo-sub">LORE</span>
      </RouterLink>

      <nav class="main-nav">
        <RouterLink to="/" :class="{ active: route.path === '/' }">Home</RouterLink>
        <RouterLink to="/heroes" :class="{ active: route.path.startsWith('/heroes') }">Heroes</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-border);
}

.header-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-lg);
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.site-logo {
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-accent);
}

.logo-sub {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--color-text-muted);
}

.main-nav {
  display: flex;
  gap: var(--spacing-lg);
}

.main-nav a {
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: color 0.2s;
}

.main-nav a:hover,
.main-nav a.active {
  color: var(--color-text);
}
</style>
