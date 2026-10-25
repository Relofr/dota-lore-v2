<script setup>
import { RouterView } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import AppFooter from "@/components/AppFooter.vue";
import AppToasts from "@/components/AppToasts.vue";
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <AppFooter />
    <AppToasts />
  </div>
</template>

<style>
/* Design tokens */
:root {
  --color-bg: #0d0f12;
  --color-header-bg: #0a0c0f;
  --color-card-bg: #13161b;
  --color-border: #1e2229;
  --color-text: #e8eaed;
  --color-text-muted: #8891a0;
  --color-accent: #ff6046;
  --color-tag-bg: #1a1e25;
  --accent-rgb: 200, 151, 42;
  --max-width: 1440px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --radius: 8px;
  --btn-radius: 999px;
  --radius-sm: 4px;

  /* Reaver for titles; Inter for UI text and numbers (tabular figures, so columns line up). */
  --font-display: "Reaver Regular", Georgia, serif;
  --font-ui: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  /* Five-step type scale (1rem = 19.2px here): label, body, emphasis, section title, page title. */
  --fs-xs: 0.6rem;
  --fs-sm: 0.7rem;
  --fs-md: 0.8rem;
  --fs-lg: 1rem;
  --fs-xl: 1.6rem;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 1.2rem;
}

@font-face {
  font-family: "Reaver Bold";
  src: url("./assets/fonts/Reaver-Bold.ttf") format("truetype");
}

@font-face {
  font-family: "Reaver Regular";
  src: url("./assets/fonts/Reaver-Regular.ttf") format("truetype");
}

/* Form controls don't inherit the page font by default. */
button, input, select, textarea {
  font-family: inherit;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: "Reaver Regular";
  line-height: 1.5;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) * 2);
}
</style>
