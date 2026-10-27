<script setup>
import { ref, computed } from 'vue'
import { formatTime } from '@/utils/matchAnalysis.js'
import BackpackIcon from './BackpackIcon.vue'

const props = defineProps({
  // [{ id, kind?: 'slot' | 'neutral' | 'backpack', count?, time? }]
  items: { type: Array, required: true },
  itemMap: { type: Map, required: true },
})

// Main slots, then the neutral item, then the backpack. Items without a kind (purchase lists) keep their
// order and fill the grid.
const KIND_ORDER = { slot: 0, neutral: 1, backpack: 2 }
const ordered = computed(() => props.items
  .filter(item => props.itemMap.get(item.id))
  .map((item, i) => ({ item, i }))
  .sort((a, b) => (KIND_ORDER[a.item.kind] ?? 0) - (KIND_ORDER[b.item.kind] ?? 0) || a.i - b.i)
  .map(({ item }) => item))

// Every row is laid out like the game's inventory: items in a grid three wide, at least two rows (empty
// slots shown), more rows if a purchase list has more than six. An inventory (items carry a kind) then
// has its neutral item, the backpack icon and the backpack items as columns beside the grid.
const cells = computed(() => {
  const of = kind => ordered.value.filter(item => (item.kind ?? 'slot') === kind)
  const slots = of('slot')
  const size = Math.max(6, Math.ceil(slots.length / 3) * 3)
  const out = Array.from({ length: size }, (_, i) => ({
    key: `slot-${i}`,
    item: slots[i] ?? null,
    style: { gridRow: Math.floor(i / 3) + 1, gridColumn: (i % 3) + 1 },
  }))
  // The side columns span the grid's rows.
  const rows = `1 / ${size / 3 + 1}`
  let col = 4
  for (const item of of('neutral')) out.push({ key: 'neutral', item, style: { gridRow: rows, gridColumn: col++ } })
  const backpack = of('backpack')
  if (backpack.length) {
    out.push({ key: 'mark', mark: true, style: { gridRow: rows, gridColumn: col++ } })
    backpack.forEach((item, i) => out.push({ key: `bp-${i}`, item, style: { gridRow: rows, gridColumn: col++ } }))
  }
  return out
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
  <div class="item-inventory">
    <template v-for="cell in cells" :key="cell.key">
      <span v-if="cell.mark" class="backpack-mark" title="Backpack" :style="cell.style">
        <BackpackIcon class="backpack-icon" />
      </span>
      <span v-else-if="!cell.item" class="item item-empty" :style="cell.style" aria-hidden="true" />
      <span
        v-else
        class="item"
        :class="[`item-${cell.item.kind ?? 'slot'}`]"
        :style="cell.style"
        :title="title(cell.item, itemMap.get(cell.item.id))"
      >
        <img
          v-if="!broken.has(cell.item.id)"
          :src="`${ITEM_IMG}/${itemMap.get(cell.item.id).shortName}.png`"
          :alt="itemMap.get(cell.item.id).displayName"
          @error="broken.add(cell.item.id)"
        />
        <span v-else class="item-fallback">{{ itemMap.get(cell.item.id).displayName }}</span>
        <span v-if="cell.item.count > 1" class="item-count">{{ cell.item.count }}</span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.item-inventory {
  display: inline-grid;
  grid-auto-rows: 25px;
  grid-auto-columns: auto;
  gap: 0.3rem;
  align-items: center;
}
/* An empty inventory slot. */
.item-empty {
  width: 34px;
  height: 25px;
  border-radius: 3px;
  background: rgba(255,255,255,.03);
  border: 1px solid var(--color-border, #2e3542);
  box-sizing: border-box;
}
/* Separates the main slots from the backpack. */
.backpack-mark {
  display: inline-flex;
  align-items: center;
  align-self: stretch;
  max-height: 26px;
  padding: 0 0.15rem 0 0.25rem;
  margin-left: 0.15rem;
  border-left: 1px solid var(--color-border, #2e3542);
  color: var(--color-muted, #7a8799);
}
.backpack-icon { width: 16px; height: 16px; }
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
/* Beside the grid, the neutral and backpack columns are centred across its two rows. */
.item-inventory .item-neutral,
.item-inventory .item-backpack { align-self: center; }
.item-inventory .item-neutral { margin-left: 0.2rem; }
.item-inventory .backpack-mark { align-self: center; height: 26px; }
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
</style>
