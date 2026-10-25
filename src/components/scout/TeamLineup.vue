<script setup>
defineProps({
  // From ScoutView's rosterTeam(): { key, label, won, players (party members adjacent), parties: [{ key, start, size, color }] }.
  team: { type: Object, required: true },
  // Hide the team badge row when something above already labels the sides.
  hideHead: { type: Boolean, default: false },
  // Keep the bracket row even with no party here, so this lineup lines up with one that has brackets.
  reserveParty: { type: Boolean, default: false },
})
</script>

<template>
  <div class="lineup" :aria-label="team.label">
    <div v-if="!hideHead" class="lineup-head">
      <span class="team-label" :class="`team-${team.key}`">{{ team.label }}</span>
      <span v-if="team.won" class="team-result">Victory</span>
    </div>
    <div class="lineup-grid">
      <span
        v-for="pt in team.parties"
        :key="pt.key"
        class="party-bracket"
        :style="{ gridColumn: `${pt.start} / span ${pt.size}`, '--party': pt.color }"
      >Party of {{ pt.size }}</span>
      <!-- An invisible bracket, the same height as a real one. -->
      <span v-if="reserveParty && !team.parties.length" class="party-bracket party-space" aria-hidden="true">&nbsp;</span>
      <!-- Each player goes in row 2 when there are brackets above, so the brackets can span their columns. -->
      <div
        v-for="player in team.players"
        :key="player.thisMatch?.playerSlot ?? player.heroId"
        class="lineup-cell"
        :style="team.parties.length || reserveParty ? { gridRow: 2 } : null"
      >
        <slot :player="player" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.lineup { min-width: 0; }
.lineup-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.team-label {
  font-size: var(--fs-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}
.team-radiant { background: rgba(75,180,95,.15); color: #4bb45f; border: 1px solid rgba(75,180,95,.3); }
.team-dire { background: rgba(200,60,60,.15); color: #c83c3c; border: 1px solid rgba(200,60,60,.3); }
.team-result {
  font-size: var(--fs-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #e8c547;
}

.lineup-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--lineup-gap, 0.55rem);
}
.lineup-cell { min-width: 0; display: flex; flex-direction: column; }
.lineup-cell > :deep(*) { flex: 1; }

/* A bracket over each party's players: a line with downturned ends and a small label. */
.party-bracket {
  grid-row: 1;
  position: relative;
  margin: 0 0.25rem;
  padding-bottom: 0.3rem;
  border-bottom: 2px solid var(--party);
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  white-space: nowrap;
  color: var(--party);
}
.party-bracket::before,
.party-bracket::after {
  content: '';
  position: absolute;
  bottom: -6px;
  width: 2px;
  height: 6px;
  background: var(--party);
}
.party-space { grid-column: 1 / -1; visibility: hidden; }
.party-bracket::before { left: 0; }
.party-bracket::after { right: 0; }
</style>
