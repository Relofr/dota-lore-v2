<script setup>
defineProps({
  // SVG stroke-dasharray, as the chart line uses it; null for solid.
  dash: { type: String, default: null },
  color: { type: String, default: 'currentColor' },
  width: { type: Number, default: 22 },
})
</script>

<template>
  <!-- A short sample of a chart line, drawn the same way so its pattern matches exactly. -->
  <svg class="line-key" :width="width" height="6" :viewBox="`0 0 ${width} 6`" aria-hidden="true">
    <line x1="1" y1="3" :x2="width - 1" y2="3" :style="{ stroke: color }" stroke-width="2" stroke-linecap="round" :stroke-dasharray="dash" />
  </svg>
</template>

<style scoped>
.line-key { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
