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
const loading = ref(true)
const error = ref(null)
let fetchStarted = false

function cleanLore(raw) {
  if (!raw) return ''
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\/g, '')
    .replace(/(?<!\w)\/(?!\w)/g, '')
    .replace(/\t/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatAlias(a) {
  return a
    .replace(/_/g, ' ')
    .replace(/[^\w\s']/g, '')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function pickAlias(aliases, displayName) {
  if (!aliases?.length) return null
  const excluded = displayName?.toLowerCase()
  const candidates = aliases.filter(a => {
    if (excluded && a.toLowerCase() === excluded) return false
    return a.length > 2 || (/[a-z]/.test(a) && /[A-Z]/.test(a))
  })
  if (!candidates.length) return null
  const longest = candidates.reduce((a, b) => b.length > a.length ? b : a)
  return formatAlias(longest)
}

function isSubstantial(str, minLen = 30) {
  return typeof str === 'string' && str.length >= minLen
}

function mapHero(apiHero, abilityLoreMap) {
  const key = apiHero.shortName || apiHero.name.replace('npc_dota_hero_', '')
  const loreData = heroLore[key] || {}
  if (!heroLore[key]) {
    console.warn(`[heroLore] no entry for key="${key}" (displayName="${apiHero.displayName}", name="${apiHero.name}", shortName="${apiHero.shortName}")`)
  }
  const roles = (apiHero.roles || [])
    .sort((a, b) => b.level - a.level)
    .map(r => ROLE_MAP[r.roleId])
    .filter(Boolean)

  const abilities = (apiHero.abilities || [])
    .sort((a, b) => a.slot - b.slot)
    .map(({ abilityId }) => abilityLoreMap.get(abilityId))
    .filter(a => a && a.lore)

  const apiLore = cleanLore(apiHero.language?.lore)
  const apiHype = cleanLore(apiHero.language?.hype)
  const apiAlias = pickAlias(apiHero.aliases, apiHero.displayName)

  return {
    id: key,
    name: apiHero.displayName,
    realName: apiAlias || (loreData.realName ? formatAlias(loreData.realName) : null) || apiHero.displayName,
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
    affiliation: loreData.affiliation || null,
    factionId: loreData.factionId || null,
    lore: isSubstantial(apiLore) ? apiLore : (loreData.lore || apiLore || ''),
    shortLore: isSubstantial(apiHype, 20) ? apiHype : (loreData.shortLore || apiHype || ''),
    abilities,
    imageUrl: `${IMG_BASE}/${key}.png`,
    iconUrl: `${IMG_BASE}/icons/${key}.png`,
  }
}

async function loadHeroes() {
  fetchStarted = true
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
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

export function useHeroes() {
  if (!fetchStarted) {
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
