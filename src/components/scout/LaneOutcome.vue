<script setup>
defineProps({
  // { text, side } from laneOutcomeText.
  outcome: { type: Object, required: true },
})
</script>

<template>
  <span class="lane-outcome" :class="`lane-${outcome.side}`">{{ outcome.text }}</span>
</template>

<style scoped>
.lane-outcome {
  display: inline-block;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1.1;
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
}
.lane-radiant { color: #4bb45f; background: rgba(75,180,95,.12); border: 1px solid rgba(75,180,95,.3); }
.lane-dire    { color: #c83c3c; background: rgba(200,60,60,.12); border: 1px solid rgba(200,60,60,.3); }
.lane-neutral { color: var(--color-muted, #7a8799); background: var(--color-border, #2e3542); border: 1px solid transparent; }
</style>
