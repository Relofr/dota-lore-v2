<script setup>
import { ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  matchId: { type: [String, Number], required: true },
})

// Shows a tick for a moment after copying.
const copied = ref(false)
let timer = null

async function copy() {
  try {
    await navigator.clipboard.writeText(String(props.matchId))
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { copied.value = false }, 1500)
  } catch (err) {
    console.error('[MatchIdCopy] clipboard:', err.message)
  }
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <span class="match-id">
    <span class="match-id-text">{{ matchId }}</span>
    <button type="button" class="copy-btn" :title="copied ? 'Copied' : 'Copy match ID'" :aria-label="copied ? 'Copied' : 'Copy match ID'" @click="copy">
      <svg v-if="!copied" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <span class="visually-hidden" aria-live="polite">{{ copied ? 'Match ID copied' : '' }}</span>
  </span>
</template>

<style scoped>
.match-id { display: inline-flex; align-items: center; gap: 0.2rem; }
.match-id-text {
  font-size: var(--fs-md);
  color: var(--color-muted, #7a8799);
  font-variant-numeric: tabular-nums;
}
.copy-btn {
  display: inline-flex;
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-muted, #7a8799);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.copy-btn:hover { color: var(--color-text); background: rgba(255, 255, 255, 0.06); }
.copy-btn:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
