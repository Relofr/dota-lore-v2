<script setup>
import { ref } from 'vue'
import { formatTime } from '@/utils/matchAnalysis.js'

defineProps({
  items: { type: Array, required: true },
  itemMap: { type: Map, required: true },
})

const ITEM_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items'
const broken = ref(new Set())

function title(item, info) {
  const name = info?.displayName ?? `Item ${item.id}`
  const parts = [name]
  if (item.count > 1) parts.push(`×${item.count}`)
  if (item.time != null) parts.push(`bought ${formatTime(item.time)}`)
  if (item.kind === 'backpack') parts.push('backpack')
  if (item.kind === 'neutral') parts.push('neutral item')
  return parts.join(' · ')
}
</script>

<template>
  <div class="item-row">
    <template v-for="(item, i) in items" :key="`${item.id}-${i}`">
      <span
        v-if="itemMap.get(item.id)"
        class="item"
        :class="[`item-${item.kind ?? 'slot'}`]"
        :title="title(item, itemMap.get(item.id))"
      >
        <img
          v-if="!broken.has(item.id)"
          :src="`${ITEM_IMG}/${itemMap.get(item.id).shortName}.png`"
          :alt="itemMap.get(item.id).displayName"
          @error="broken.add(item.id)"
        />
        <span v-else class="item-fallback">{{ itemMap.get(item.id).displayName }}</span>
        <span v-if="item.count > 1" class="item-count">{{ item.count }}</span>
        <span v-if="item.time != null" class="item-time">{{ formatTime(item.time) }}</span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.item-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: flex-start;
}
.item {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  width: 34px;
}
.item img,
.item-fallback {
  width: 34px;
  height: 25px;
  border-radius: 3px;
  object-fit: cover;
  background: var(--color-border, #2e3542);
}
.item-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.45rem;
  line-height: 1;
  text-align: center;
  color: var(--color-muted, #7a8799);
}
.item-neutral img { border-radius: 50%; width: 25px; }
.item-backpack img { opacity: 0.45; }
.item-count {
  position: absolute;
  top: 12px;
  right: 1px;
  font-size: 0.55rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px #000, 0 0 2px #000;
}
.item-time {
  font-size: 0.55rem;
  color: var(--color-muted, #7a8799);
  font-variant-numeric: tabular-nums;
}
</style>
