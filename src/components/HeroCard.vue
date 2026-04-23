<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  hero: {
    type: Object,
    required: true,
  },
  excerpt: {
    type: Object,
    default: null,
  },
})

const imgError = ref(false)

const attributeIcons = {
  strength:     'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_strength.png',
  agility:      'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_agility.png',
  intelligence: 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_intelligence.png',
  universal:    'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/hero_universal.png',
}

const attributeColors = {
  strength:     '#c83c3c',
  agility:      '#3ca050',
  intelligence: '#3c64c8',
  universal:    '#8c50c8',
}
</script>

<template>
  <RouterLink :to="`/heroes/${hero.id}`" class="hero-card">
    <div class="hero-image-wrap">
      <img
        v-if="hero.imageUrl && !imgError"
        :src="hero.imageUrl"
        :alt="hero.name"
        class="hero-image"
        loading="lazy"
        @error="imgError = true"
      />
      <div
        v-else
        class="hero-image-fallback"
        :style="{ borderColor: attributeColors[hero.primaryAttribute] }"
      >
        <span>{{ hero.name.charAt(0) }}</span>
      </div>
    </div>

    <div class="hero-info">
      <h3 class="hero-name">
        {{ hero.name }}
        <RouterLink
          :to="`/heroes?attr=${hero.primaryAttribute}`"
          class="attr-icon-wrap"
          :data-label="hero.primaryAttribute.charAt(0).toUpperCase() + hero.primaryAttribute.slice(1)"
          :style="{ '--attr-color': attributeColors[hero.primaryAttribute] }"
          @click.stop
        >
          <img
            class="attribute-icon"
            :src="attributeIcons[hero.primaryAttribute]"
            :alt="hero.primaryAttribute"
          />
        </RouterLink>
      </h3>
      <p class="hero-real-name">{{ hero.realName !== hero.name ? hero.realName : ' ' }}</p>
      <div class="hero-roles">
        <span v-for="role in hero.roles.slice(0, 3)" :key="role" class="role-tag">{{ role }}</span>
      </div>
      <p v-if="excerpt" class="hero-short-lore">
        {{ excerpt.before }}<span class="excerpt-match">{{ excerpt.match }}</span>{{ excerpt.after }}
      </p>
      <p v-else-if="hero.shortLore" class="hero-short-lore">{{ hero.shortLore }}</p>
    </div>
  </RouterLink>
</template>

<style scoped>
.hero-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  transition: border-color 0.2s, transform 0.2s;
}

.hero-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.hero-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--color-border);
  border-radius: var(--radius) var(--radius) 0 0;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px solid;
  font-size: 2rem;
  color: var(--color-text-muted);
}

.hero-info {
  padding: var(--spacing-md);
}

.hero-name {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 2px;
  color: var(--color-text);
  font-family: "Reaver Bold";
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: space-between;
}

.attr-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.attr-icon-wrap::after {
  content: attr(data-label);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #252b36;
  border: 1px solid #2e3542;
  color: var(--color-text);
  font-size: 0.7rem;
  font-family: "Reaver Regular";
  font-weight: 400;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
  z-index: 10;
}

.attr-icon-wrap:hover::after {
  opacity: 1;
}

.attr-icon-wrap:hover {
  background: color-mix(in srgb, var(--attr-color) 16%, var(--color-tag-bg));
  border-radius: 3px;
}

.attribute-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.hero-real-name {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0 0 6px;
  font-style: italic;
}

.hero-roles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
}


.role-tag {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--color-tag-bg);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.hero-short-lore {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.excerpt-match {
  color: var(--color-accent);
  font-weight: 500;
}
</style>
