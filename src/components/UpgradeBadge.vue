<script setup>
import { ref, computed } from 'vue'
import ScepterIcon from './ScepterIcon.vue'
import ShardIcon from './ShardIcon.vue'

const props = defineProps({
  type: { type: String, required: true },
})

const hovering = ref(false)
const label = computed(() => props.type === 'scepter' ? "Aghanim's Scepter" : "Aghanim's Shard")
</script>

<template>
  <span
    class="upgrade-wrap"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <ScepterIcon v-if="type === 'scepter'" class="upgrade-badge" />
    <ShardIcon   v-else                    class="upgrade-badge" />

    <span v-if="hovering" class="upgrade-tooltip">
      <span class="tooltip-header">
        <ScepterIcon v-if="type === 'scepter'" class="tooltip-badge-icon" />
        <ShardIcon   v-else                    class="tooltip-badge-icon" />
        <span class="tooltip-name">{{ label }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.upgrade-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.upgrade-badge {
  display: block;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  cursor: default;
}

.upgrade-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #252b36;
  border: 1px solid #2e3542;
  border-radius: var(--radius);
  padding: 8px 12px;
  min-width: 140px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tooltip-badge-icon {
  display: block;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.tooltip-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text);
}
</style>
