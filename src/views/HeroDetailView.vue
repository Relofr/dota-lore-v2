<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useHeroes } from "@/composables/useHeroes.js";
import { useSpeech } from "@/composables/useSpeech.js";
import LoreText from "@/components/LoreText.vue";

import meleeIcon   from "@/assets/images/melee.svg";
import rangedIcon  from "@/assets/images/ranged.svg";
import attackIcon  from "@/assets/images/attack.svg";
import defenseIcon from "@/assets/images/defense.svg";
import mobilityIcon from "@/assets/images/mobility.svg";

const route = useRoute();
const router = useRouter();
const { heroes, loading } = useHeroes();

const videoReady = ref(false)
const { speaking, paused, loading: ttsLoading, supported, toggle: toggleSpeech, stop: stopSpeech } = useSpeech()
watch(() => route.params.id, () => { videoReady.value = false; stopSpeech() })

const searchOpen  = ref(false)
const searchQuery = ref('')
const searchInput = ref(null)

const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return []
  return heroes.value
    .filter(h => h.id !== route.params.id && (
      h.name.toLowerCase().includes(q) ||
      (h.realName && h.realName.toLowerCase().includes(q))
    ))
    .slice(0, 6)
})

function openSearch() {
  searchOpen.value = true
  searchQuery.value = ''
  setTimeout(() => searchInput.value?.focus(), 50)
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
}

function goToResult(hero) {
  router.push(`/heroes/${hero.id}`)
  closeSearch()
}

function onSearchKeydown(e) {
  if (e.key === 'Enter' && searchResults.value.length) {
    goToResult(searchResults.value[0])
  } else if (e.key === 'Escape') {
    closeSearch()
  }
}

function onGlobalKeydown(e) {
  if (searchOpen.value || e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key.length === 1) {
    e.preventDefault()
    searchQuery.value = e.key
    searchOpen.value = true
    setTimeout(() => searchInput.value?.focus(), 50)
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))

function goToRandom() {
  const others = heroes.value.filter(h => h.id !== route.params.id)
  if (!others.length) return
  const pick = others[Math.floor(Math.random() * others.length)]
  router.push(`/heroes/${pick.id}`)
}

const hero = computed(
  () => heroes.value.find((h) => h.id === route.params.id) || null,
);

const heroIndex = computed(() => heroes.value.findIndex(h => h.id === route.params.id))
const prevHero = computed(() => heroIndex.value > 0 ? heroes.value[heroIndex.value - 1] : heroes.value[heroes.value.length - 1])
const nextHero = computed(() => heroIndex.value < heroes.value.length - 1 ? heroes.value[heroIndex.value + 1] : heroes.value[0])

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

    const forwardMatch = otherNames.find(n =>
      new RegExp(`\\b${n.replace(ESCAPE_RE, '\\$&')}\\b`, 'i').test(loreText)
    )
    if (forwardMatch) {
      results.push({ hero: other, excerpt: getExcerpt(loreText, forwardMatch) })
      continue
    }

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

const factionHeroes = computed(() => {
  if (!hero.value?.factionId) return []
  const loreIds = new Set(relatedHeroes.value.map(r => r.hero.id))
  return heroes.value.filter(
    h => h.id !== hero.value.id && h.factionId === hero.value.factionId && !loreIds.has(h.id)
  )
})

const attributeColors = {
  strength: "#c83c3c",
  agility: "#3ca050",
  intelligence: "#3c64c8",
  universal: "#8c50c8",
};

const attributeIcons = {
  strength:     'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_strength.png',
  agility:      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_agility.png',
  intelligence: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_intelligence.png',
  universal:    'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_universal.png',
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
    <div class="top-bar">
      <nav class="breadcrumb">
        <RouterLink to="/heroes">Heroes</RouterLink>
        <svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="currentColor"><path d="M400-240l-56-56 184-184-184-184 56-56 240 240-240 240Z"/></svg>
        <span>{{ hero.name }}</span>
      </nav>
    </div>

    <div v-if="heroes.length > 1" class="hero-nav">
      <RouterLink :to="`/heroes/${prevHero.id}`" class="hero-nav-btn hero-nav-prev">
        <svg class="hero-nav-arrow" xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="currentColor"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>
        <img :src="prevHero.iconUrl" :alt="prevHero.name" class="hero-nav-icon" />
      </RouterLink>
      <button class="hero-nav-random" title="Random hero" @click="goToRandom">
        <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="currentColor"><path d="M682.5-277.5Q700-295 700-320t-17.5-42.5Q665-380 640-380t-42.5 17.5Q580-345 580-320t17.5 42.5Q615-260 640-260t42.5-17.5Zm-160-160Q540-455 540-480t-17.5-42.5Q505-540 480-540t-42.5 17.5Q420-505 420-480t17.5 42.5Q455-420 480-420t42.5-17.5Zm-160-160Q380-615 380-640t-17.5-42.5Q345-700 320-700t-42.5 17.5Q260-665 260-640t17.5 42.5Q295-580 320-580t42.5-17.5ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Z"/></svg>
      </button>
      <RouterLink :to="`/heroes/${nextHero.id}`" class="hero-nav-btn">
        <img :src="nextHero.iconUrl" :alt="nextHero.name" class="hero-nav-icon" />
        <svg class="hero-nav-arrow" xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="currentColor"><path d="M400-240l-56-56 184-184-184-184 56-56 240 240-240 240Z"/></svg>
      </RouterLink>
    </div>

    <div class="hero-header">
      <div class="hero-meta">
        <h1 class="hero-title">{{ hero.name }}</h1>
        <p v-if="hero.realName !== hero.name" class="hero-real-name">
          <em>{{ hero.realName }}</em>
        </p>
        <div class="meta-row">
          <RouterLink
            :to="`/heroes?attr=${hero.primaryAttribute}`"
            class="attribute-badge"
            :style="{
              '--attr-color': attributeColors[hero.primaryAttribute],
              background: attributeColors[hero.primaryAttribute] + '22',
              color: attributeColors[hero.primaryAttribute],
              borderColor: attributeColors[hero.primaryAttribute] + '55',
            }"
          >
            <img
              class="attribute-badge-icon"
              :src="attributeIcons[hero.primaryAttribute]"
              :alt="hero.primaryAttribute"
            />
            {{
              hero.primaryAttribute.charAt(0).toUpperCase() +
              hero.primaryAttribute.slice(1)
            }}
          </RouterLink>
          <RouterLink
            v-if="hero.factionId"
            :to="`/heroes?faction=${hero.factionId}`"
            class="affiliation-badge"
          >{{ hero.affiliation }}</RouterLink>
          <span class="meta-divider" />
          <span v-if="hero.attackType" class="attack-badge">{{ hero.attackType }}</span>
          <span v-for="role in hero.roles" :key="role" class="role-tag">{{ role }}</span>
        </div>
      </div>
    </div>

    <!-- Single flex row: all content left, portrait sticky right -->
    <div class="hero-layout">
      <div class="hero-content">
        <div v-if="hero.lore" class="lore-section">
          <div class="lore-heading">
            <h2>Lore</h2>
            <button
              v-if="false"
              class="lore-listen-btn"
              :class="{ loading: ttsLoading }"
              :disabled="ttsLoading"
              :title="ttsLoading ? 'Loading…' : speaking && !paused ? 'Pause' : paused ? 'Resume' : 'Listen'"
              @click="toggleSpeech(hero.lore)"
            >
              <!-- Loading spinner -->
              <svg v-if="ttsLoading" class="spin" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Z"/></svg>
              <!-- Pause -->
              <svg v-else-if="speaking && !paused && !ttsLoading" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Z"/></svg>
              <!-- Play -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M320-200v-560l440 280-440 280Z"/></svg>
            </button>
          </div>
          <LoreText :lore="hero.lore" :hero-id="hero.id" />
        </div>
        <div v-else class="lore-section lore-empty">
          <h2>Lore</h2>
          <p class="lore-placeholder">Extended lore for {{ hero.name }} coming soon.</p>
        </div>

        <div v-if="relatedHeroes.length || factionHeroes.length" class="related-section">
          <h2>Related Heroes</h2>

          <template v-if="relatedHeroes.length">
            <p class="related-label">Mentioned in lore</p>
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
          </template>

          <template v-if="factionHeroes.length">
            <p class="related-label">{{ hero.affiliation }}</p>
            <div class="related-chips">
              <RouterLink
                v-for="fh in factionHeroes"
                :key="fh.id"
                :to="`/heroes/${fh.id}`"
                class="related-chip"
              >
                <img :src="fh.iconUrl" :alt="fh.name" class="related-chip-icon" />
                <span class="related-chip-name">{{ fh.name }}</span>
              </RouterLink>
            </div>
          </template>
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

      <div
        class="hero-portrait-wrap"
        :class="`portrait-${hero.id}`"
      >
        <img
          v-if="!videoReady"
          :key="`poster-${hero.id}`"
          class="hero-portrait-img hero-portrait-poster"
          :src="`https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${hero.id}.png`"
          :alt="hero.name"
        />
        <video
          :key="hero.id"
          class="hero-portrait-img"
          :poster="`https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${hero.id}.png`"
          autoplay
          muted
          preload="auto"
          loop
          playsinline
          @canplay="videoReady = true"
        >
          <source
            type="video/webm"
            :src="`https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${hero.id}.webm`"
          />
        </video>
      </div>
    </div>

    <!-- Floating hero search -->
    <Transition name="search-fade">
      <div v-if="searchOpen" class="hero-search-overlay" @click.self="closeSearch">
        <div class="hero-search-box">
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="hero-search-input"
            placeholder="Search heroes…"
            @keydown="onSearchKeydown"
          />
          <div v-if="searchResults.length" class="hero-search-results">
            <button
              v-for="h in searchResults"
              :key="h.id"
              class="hero-search-result"
              @click="goToResult(h)"
            >
              <img :src="h.iconUrl" :alt="h.name" class="hero-search-icon" />
              <span class="hero-search-name">{{ h.name }}</span>
              <span v-if="h.realName !== h.name" class="hero-search-real">{{ h.realName }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
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

.top-bar {
  margin-bottom: var(--spacing-lg);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
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


.hero-content {
  max-width: 680px;
}

.hero-portrait-wrap {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  pointer-events: none;
  z-index: 1;
}

.hero-portrait-img {
  grid-area: 1 / 1;
  width: 60%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: auto;
}

.hero-portrait-poster {
  animation-name: portrait-fade-in;
  animation-duration: 0.4s;
  animation-timing-function: ease-out;
  animation-fill-mode: both;
}

video.hero-portrait-img {
  animation-name: portrait-fade-in;
  animation-duration: 1.3s;
  animation-timing-function: ease-out;
  animation-delay: 0s;
  animation-iteration-count: 1;
  animation-fill-mode: both;
}

@keyframes portrait-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.portrait-broodmother {
  justify-items: end;
}

.portrait-broodmother .hero-portrait-img {
  object-fit: contain;
  width: 48%;
  margin-right: 2%;
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
  align-items: center;
  gap: 6px;
  margin-bottom: var(--spacing-sm);
}

.meta-divider {
  width: 1px;
  height: 16px;
  background: var(--color-border);
  flex-shrink: 0;
}

.attribute-badge {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid;
  display: inline-flex;
  text-decoration: none;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
}

.attribute-badge:hover {
  background: color-mix(in srgb, var(--attr-color) 16%, var(--color-card-bg)) !important;
  border-color: color-mix(in srgb, var(--attr-color) 60%, transparent) !important;
}

.attribute-badge-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
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

.affiliation-badge {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-card-bg));
  color: var(--color-accent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}

a.affiliation-badge:hover {
  background: color-mix(in srgb, var(--color-accent) 16%, var(--color-card-bg));
  border-color: color-mix(in srgb, var(--color-accent) 60%, transparent);
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

.lore-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--spacing-sm);
}

.lore-heading h2 {
  margin: 0;
}

.lore-listen-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 0;
  transition: color 0.15s;
}

.lore-listen-btn:hover {
  color: var(--color-accent);
}

.lore-listen-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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

.lore-section .lore-heading h2 {
  border-bottom: none;
  padding-bottom: 0;
  margin: 0;
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

.related-label {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin: 0 0 8px;
}

.related-label + .related-chips {
  margin-bottom: var(--spacing-md);
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
  border-radius: 998px;
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

.hero-nav {
  position: fixed;
  bottom: var(--spacing-lg);
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: auto auto auto;
  gap: var(--spacing-md);
  align-items: center;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 8px 16px;
  z-index: 10;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.hero-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  transition: color 0.15s;
  white-space: nowrap;
}

.hero-nav-prev {
  justify-content: flex-start;
}

.hero-nav-prev .hero-nav-name {
  margin-left: auto;
}

.hero-nav-next {
  justify-content: flex-end;
}

.hero-nav-next .hero-nav-arrow {
  margin-left: auto;
}

.hero-nav-btn:hover {
  color: var(--color-text);
}

.hero-nav-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.hero-nav-btn:hover .hero-nav-icon {
  opacity: 1;
}

.hero-nav-random {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 0 4px;
  transition: color 0.15s;
  flex-shrink: 0;
}

.hero-nav-random:hover {
  color: var(--color-text);
}

.hero-nav-random:hover svg {
  animation: dice-roll 0.5s ease-in-out;
}

@keyframes dice-roll {
  0%   { transform: rotate(0deg) scale(1); }
  25%  { transform: rotate(-20deg) scale(1.15); }
  50%  { transform: rotate(20deg) scale(1.2); }
  75%  { transform: rotate(-10deg) scale(1.15); }
  100% { transform: rotate(0deg) scale(1); }
}

.hero-nav-arrow {
  flex-shrink: 0;
  display: block;
}

/* Floating hero search */
.hero-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
  background: rgba(0, 0, 0, 0.5);
}

.hero-search-box {
  width: 100%;
  max-width: 480px;
  background: #252b36;
  border: 1px solid #2e3542;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
}

.hero-search-input {
  width: 100%;
  height: 52px;
  padding: 0 var(--spacing-lg);
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
}

.hero-search-results {
  border-top: 1px solid #2e3542;
  display: flex;
  flex-direction: column;
}

.hero-search-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px var(--spacing-lg);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
  width: 100%;
}

.hero-search-result:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, #252b36);
}

.hero-search-icon {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

.hero-search-name {
  color: var(--color-text);
  font-size: 0.9rem;
  flex: 1;
}

.hero-search-real {
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-style: italic;
}

.search-fade-enter-active,
.search-fade-leave-active {
  transition: opacity 0.15s;
}
.search-fade-enter-from,
.search-fade-leave-to {
  opacity: 0;
}
</style>
