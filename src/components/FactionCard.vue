<script setup>
import { RouterLink } from 'vue-router'

const props = defineProps({
  faction: {
    type: Object,
    required: true,
  },
})

const alignmentLabels = {
  light: 'Light',
  dark: 'Dark',
  neutral: 'Neutral',
}
</script>

<template>
  <RouterLink :to="`/factions/${faction.id}`" class="faction-card">
    <div class="faction-header">
      <div class="faction-alignment" :data-alignment="faction.alignment">
        {{ alignmentLabels[faction.alignment] }}
      </div>
      <span class="faction-type">{{ faction.type }}</span>
    </div>
    <h3 class="faction-name">{{ faction.name }}</h3>
    <p class="faction-desc">{{ faction.shortDescription }}</p>
    <div class="faction-footer">
      <span class="member-count">
        {{ faction.memberIds.length }}
        {{ faction.memberIds.length === 1 ? 'hero' : 'heroes' }}
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
.faction-card {
  display: block;
  text-decoration: none;
  color: inherit;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--spacing-md);
  transition: border-color 0.2s, transform 0.2s;
}

.faction-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.faction-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.faction-alignment {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
}

.faction-alignment[data-alignment='light'] {
  background: rgba(255, 220, 100, 0.15);
  color: #d4af37;
  border: 1px solid rgba(255, 220, 100, 0.3);
}

.faction-alignment[data-alignment='dark'] {
  background: rgba(160, 60, 200, 0.15);
  color: #a855f7;
  border: 1px solid rgba(160, 60, 200, 0.3);
}

.faction-alignment[data-alignment='neutral'] {
  background: rgba(150, 150, 150, 0.1);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.faction-type {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.faction-name {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 var(--spacing-sm);
  color: var(--color-text);
}

.faction-desc {
  font-size: 0.83rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0 0 var(--spacing-md);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.faction-footer {
  display: flex;
  align-items: center;
}

.member-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
