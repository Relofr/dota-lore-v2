<script setup>
import { useToasts, dismissToast } from '@/composables/useToast.js'

const toasts = useToasts()
</script>

<template>
  <!-- Polite live region: screen readers announce new toasts without interrupting. -->
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
        <span class="toast-message">{{ t.message }}</span>
        <button type="button" class="toast-close" aria-label="Dismiss" @click="dismissToast(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 340px;
  padding: 0.6rem 0.6rem 0.6rem 0.85rem;
  background: #1a1f2b;
  border: 1px solid var(--color-border, #2e3542);
  border-left: 3px solid #c83c3c;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  font-size: 0.8rem;
  color: var(--color-text);
}
.toast-info { border-left-color: #34bfff; }
.toast-message { flex: 1; line-height: 1.35; }
.toast-close {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted, #8891a0);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}
.toast-close:hover { color: var(--color-text); background: rgba(255, 255, 255, 0.06); }
.toast-close:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(12px); }
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active { transition: none; }
}
</style>
