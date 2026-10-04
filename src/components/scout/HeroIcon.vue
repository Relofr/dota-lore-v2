<script setup>
import { computed } from 'vue'
import { heroImage } from '@/utils/matchAnalysis.js'

const props = defineProps({
  hero: { type: Object, default: null },
  // Wide portrait instead of the square icon.
  wide: { type: Boolean, default: false },
})

const name = computed(() => props.hero?.displayName ?? 'Unknown hero')
const src = computed(() => heroImage(props.hero, props.wide))
</script>

<template>
  <img v-if="src" :src="src" :alt="name" :title="name" class="hero-icon" />
  <span v-else class="hero-icon hero-icon-empty" role="img" :aria-label="name" :title="name" />
</template>

<style scoped>
.hero-icon {
  display: inline-block;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--color-border, #2e3542);
  vertical-align: middle;
}
</style>
