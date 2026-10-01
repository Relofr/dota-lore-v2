<script setup>
import { computed } from 'vue'

const props = defineProps({
  rank: { type: Number, default: null },
  leaderboardRank: { type: Number, default: null },
})

const ASSETS = 'https://www.opendota.com/assets/images/dota2/rank_icons'
const MEDALS = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']

const tier = computed(() => Math.floor((props.rank ?? 0) / 10))
const stars = computed(() => (props.rank ?? 0) % 10)
const isImmortal = computed(() => tier.value === 8)

const medalSrc = computed(() => {
  if (isImmortal.value && props.leaderboardRank) {
    if (props.leaderboardRank <= 10) return `${ASSETS}/rank_icon_8c.png`
    if (props.leaderboardRank <= 100) return `${ASSETS}/rank_icon_8b.png`
  }
  return `${ASSETS}/rank_icon_${tier.value}.png`
})

const label = computed(() => {
  const name = MEDALS[tier.value - 1]
  if (!name) return 'Uncalibrated'
  if (isImmortal.value) return props.leaderboardRank ? `Immortal #${props.leaderboardRank}` : 'Immortal'
  return stars.value ? `${name} ${stars.value}` : name
})
</script>

<template>
  <span v-if="tier >= 1 && tier <= 8" class="rank-medal" :title="label">
    <img :src="medalSrc" class="medal" alt="" />
    <img v-if="!isImmortal && stars" :src="`${ASSETS}/rank_star_${stars}.png`" class="stars" alt="" />
    <span v-if="isImmortal && leaderboardRank" class="leaderboard">{{ leaderboardRank }}</span>
  </span>
</template>

<style scoped>
.rank-medal {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
}

.medal,
.stars {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.leaderboard {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 3px #000, 0 0 2px #000;
  line-height: 1;
}
</style>
