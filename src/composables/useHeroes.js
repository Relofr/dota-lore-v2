import { ref } from 'vue'
import { heroLore } from '@/data/heroLore.js'
import { fetchStratzHeroes } from '@/services/stratzApi.js'

const IMG_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes'

const ROLE_MAP = {
  CARRY: 'Carry',
  SUPPORT: 'Support',
  NUKER: 'Nuker',
  DISABLER: 'Disabler',
  DURABLE: 'Durable',
  ESCAPE: 'Escape',
  PUSHER: 'Pusher',
  INITIATOR: 'Initiator',
}

const ATTR_MAP = {
  str: 'strength',
  agi: 'agility',
  int: 'intelligence',
  all: 'universal',
}

// Module-level shared state — all components share the same fetch
const heroes = ref([])
const loading = ref(false)
const error = ref(null)
let loaded = false

function cleanLore(raw) {
  if (!raw) return ''
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\t/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function mapHero(apiHero, abilityLoreMap) {
  const key = apiHero.shortName || apiHero.name.replace('npc_dota_hero_', '')
  const loreData = heroLore[key] || {}
  const roles = (apiHero.roles || [])
    .sort((a, b) => b.level - a.level)
    .map(r => ROLE_MAP[r.roleId])
    .filter(Boolean)

  const abilities = (apiHero.abilities || [])
    .sort((a, b) => a.slot - b.slot)
    .map(({ abilityId }) => abilityLoreMap.get(abilityId))
    .filter(a => a && a.lore)

  return {
    id: key,
    name: apiHero.displayName,
    realName: loreData.realName || apiHero.displayName,
    primaryAttribute: ATTR_MAP[apiHero.stats?.primaryAttribute] || 'universal',
    roles,
    attackType: apiHero.stats?.attackType || null,
    complexity: apiHero.stats?.complexity || 1,
    stats: {
      damageMin: apiHero.stats?.startingDamageMin ?? 0,
      damageMax: apiHero.stats?.startingDamageMax ?? 0,
      attackRate: apiHero.stats?.attackRate ?? 0,
      attackRange: apiHero.stats?.attackRange ?? 0,
      armor: apiHero.stats?.startingArmor ?? 0,
      magicResist: apiHero.stats?.startingMagicArmor ?? 0,
      hpRegen: apiHero.stats?.hpRegen ?? 0,
      moveSpeed: apiHero.stats?.moveSpeed ?? 0,
    },
    lore: cleanLore(apiHero.language?.lore),
    shortLore: cleanLore(apiHero.language?.hype),
    abilities,
    imageUrl: `${IMG_BASE}/${key}.png`,
    iconUrl: `${IMG_BASE}/icons/${key}.png`,
  }
}

async function loadHeroes() {
  loading.value = true
  try {
    const data = await fetchStratzHeroes()

    const ABILITY_IMG = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities'
    const abilityLoreMap = new Map()
    for (const ab of data.abilities || []) {
      if (ab.isTalent) continue
      const lore = cleanLore(ab.language?.lore)
      if (!lore) continue
      abilityLoreMap.set(ab.id, {
        id: ab.id,
        name: ab.name,
        displayName: ab.language?.displayName || ab.name,
        iconUrl: `${ABILITY_IMG}/${ab.name}.png`,
        lore,
      })
    }

    heroes.value = data.heroes
      .filter(h => h.displayName && h.shortName)
      .map(h => mapHero(h, abilityLoreMap))
      .sort((a, b) => a.name.localeCompare(b.name))
    loaded = true
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

export function useHeroes() {
  if (!loaded && !loading.value) {
    loadHeroes()
  }
  return { heroes, loading, error }
}

export function getHeroById(id) {
  return heroes.value.find(h => h.id === id) || null
}

export const allRoles = [
  'Carry',
  'Support',
  'Nuker',
  'Disabler',
  'Initiator',
  'Durable',
  'Escape',
  'Pusher',
]

export const allAttributes = ['strength', 'agility', 'intelligence', 'universal']
