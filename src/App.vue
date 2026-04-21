<script setup>
import { RouterView } from "vue-router";
import AppHeader from "@/components/AppHeader.vue";
import AppFooter from "@/components/AppFooter.vue";
</script>

<template>
  <div class="app-layout">
    <AppHeader />
    <main class="app-main">
      <RouterView />
    </main>
    <AppFooter />
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
  --color-text-muted: #7a8494;
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
  font-family: "Reaver Regular";
  src: local("Reaver Regular"), url("../fonts/Reaver-Regular.ttf");
}

@font-face {
  font-family: "Reaver Bold";
  src:
    local("Reaver Bold"),
    url("../fonts/Reaver-Bold.ttf") format("truetype");
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
