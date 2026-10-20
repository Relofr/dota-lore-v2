<script setup>
import HeroIcon from './HeroIcon.vue'
import LaneOutcome from './LaneOutcome.vue'

defineProps({
  // A laneGroups entry: { key, label, short, outcome, radiant, dire }.
  group: { type: Object, required: true },
  // Whether this lane's section is the one in view.
  active: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<template>
  <button
    class="lane-card"
    :class="{ active }"
    type="button"
    :aria-current="active ? 'location' : null"
    :title="`Jump to ${group.label}`"
    @click="$emit('select', group.key)"
  >
    <span class="card-head">
      <span class="card-title">{{ group.short ?? group.label }}</span>
      <LaneOutcome v-if="group.outcome" :outcome="group.outcome" />
    </span>

    <span class="card-heroes" :class="{ solo: group.radiant.length <= 1 && group.dire.length <= 1 }">
      <span class="heroes heroes-r">
        <HeroIcon v-for="p in group.radiant" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
      <em>vs</em>
      <span class="heroes heroes-d">
        <HeroIcon v-for="p in group.dire" :key="p.thisMatch?.playerSlot" :hero="p.thisMatch?.hero" class="card-hero" />
      </span>
    </span>
  </button>
</template>

<style scoped>
.lane-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  text-align: left;
  font: inherit;
  color: var(--color-text);
  background: rgba(255,255,255,.02);
  border: 1px solid var(--color-border, #2e3542);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.lane-card:hover { border-color: rgba(52,191,255,.4); background: rgba(52,191,255,.05); }
.lane-card:focus-visible { outline: 2px solid #34bfff; outline-offset: 2px; }
.lane-card.active { border-color: rgba(52,191,255,.55); background: rgba(52,191,255,.07); box-shadow: inset 3px 0 0 #34bfff; }

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.card-title { font-size: 0.85rem; font-weight: 700; }

.card-heroes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.card-heroes em {
  font-style: normal;
  font-size: 0.68rem;
  color: var(--color-muted, #7a8799);
}
/* Each side's heroes grouped on its team colour. */
.heroes {
  display: flex;
  gap: 0.25rem;
  flex: 1;
  justify-content: space-evenly;
  padding: 0.3rem;
  border-radius: 6px;
}
/* A 1v1 lane (mid) hugs its single heroes instead of stretching, so the pair sits centred. */
.solo .heroes { flex: none; }
.heroes-r { background: rgba(75,180,95,.16); box-shadow: inset 0 0 0 1px rgba(75,180,95,.3); }
.heroes-d { background: rgba(200,60,60,.16); box-shadow: inset 0 0 0 1px rgba(200,60,60,.3); }
.card-hero { width: 34px; height: 34px; border-radius: 4px; }
</style>
