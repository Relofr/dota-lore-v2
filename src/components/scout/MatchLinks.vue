<script setup>
import StratzIcon from '@/components/StratzIcon.vue'
import { OPENDOTA_ICON, DOTABUFF_ICON } from '@/utils/siteIcons.js'

defineProps({
  matchId: { type: [String, Number], required: true },
})
</script>

<template>
  <div class="match-links">
    <a :href="`https://stratz.com/matches/${matchId}`" target="_blank" rel="noopener noreferrer" class="match-link" title="Open on Stratz" aria-label="Open this match on Stratz">
      <StratzIcon class="match-logo" />
    </a>
    <a :href="`https://www.opendota.com/matches/${matchId}`" target="_blank" rel="noopener noreferrer" class="match-link" title="Open on OpenDota" aria-label="Open this match on OpenDota">
      <img :src="OPENDOTA_ICON" class="match-logo" alt="" />
    </a>
    <a :href="`https://www.dotabuff.com/matches/${matchId}`" target="_blank" rel="noopener noreferrer" class="match-link" title="Open on Dotabuff" aria-label="Open this match on Dotabuff">
      <img :src="DOTABUFF_ICON" class="match-logo" alt="" />
    </a>
  </div>
</template>

<style scoped>
/* Same look as the profile links on the player cards. */
.match-links { display: flex; justify-content: center; align-items: center; gap: 0.15rem; }
.match-link {
  display: flex;
  padding: 0.2rem;
  border-radius: 50%;
  opacity: 0.85;
  transition: opacity 0.15s, transform 0.15s;
}
.match-link:hover { opacity: 1; transform: scale(1.08); }
.match-link:focus-visible { outline: 2px solid #34bfff; outline-offset: 1px; }
.match-logo { display: block; width: 22px; height: 22px; border-radius: 50%; }
</style>
