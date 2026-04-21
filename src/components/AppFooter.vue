<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <p class="footer-note">
        Dota 2 and all related content are property of Valve Corporation. This is a fan-made lore
        reference site.
      </p>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}

.footer-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--spacing-lg);
  text-align: center;
}

.footer-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
