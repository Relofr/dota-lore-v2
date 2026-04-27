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
  if (Array.isArray(raw)) raw = raw.join('\n')
  else if (typeof raw !== 'string') raw = String(raw)
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
    if (!a || typeof a !== 'string') return false
    if (excluded && a.toLowerCase() === excluded) return false
    return a.length > 2 || (/[a-z]/.test(a) && /[A-Z]/.test(a))
  })
  if (!candidates.length) return null
  const longest = candidates.reduce((a, b) => b.length > a.length ? b : a)
  return formatAlias(longest)
}

function heroInitials(name) {
  if (!name) return ''
  return name.split(/[\s-]+/).map(w => w[0]?.toLowerCase()).filter(Boolean).join('')
}

function isSubstantial(str, minLen = 30) {
  return typeof str === 'string' && str.length >= minLen
}

function mapHero(apiHero, abilityLoreMap, talentMap) {
  const key = apiHero.shortName || apiHero.name.replace('npc_dota_hero_', '')
  const loreData = heroLore[key] || {}
  if (!heroLore[key]) {
    console.warn(`[heroLore] no entry for key="${key}" (displayName="${apiHero.displayName}", name="${apiHero.name}", shortName="${apiHero.shortName}")`)
  }
  const roles = (apiHero.roles || [])
    .sort((a, b) => b.level - a.level)
    .map(r => ROLE_MAP[r.roleId])
    .filter(Boolean)

  const sortedSlots = (apiHero.abilities || []).sort((a, b) => a.slot - b.slot)

  const abilities = sortedSlots
    .map(({ abilityId }) => abilityLoreMap.get(abilityId))
    .filter(a => a && (a.isInnate || a.lore || a.scepterDescription || a.shardDescription))
    .sort((a, b) => (b.isInnate ? 1 : 0) - (a.isInnate ? 1 : 0))

  const talents = sortedSlots
    .map(({ slot, abilityId }) => ({ slot, ...talentMap.get(abilityId) }))
    .filter(t => t.id)

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
    talents,
    initials: heroInitials(apiHero.displayName),
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
    const talentMap = new Map()
    for (const ab of data.abilities || []) {
      if (ab.isTalent) {
        const displayName = ab.language?.displayName
        if (displayName) talentMap.set(ab.id, { id: ab.id, name: ab.name, displayName })
        continue
      }
      const isInnate = ab.stat?.isInnate || false
      const isGrantedByScepter = ab.stat?.isGrantedByScepter || false
      const isGrantedByShard   = ab.stat?.isGrantedByShard   || false
      const hasScepter = ab.stat?.hasScepterUpgrade || isGrantedByScepter
      const hasShard   = ab.stat?.hasShardUpgrade   || isGrantedByShard
      const lore               = cleanLore(ab.language?.lore)
      const description        = cleanLore(ab.language?.description) || null
      const scepterDescription = cleanLore(ab.language?.aghanimDescription) || null
      const shardDescription   = cleanLore(ab.language?.shardDescription)   || null
      const effectiveLore = lore || ((isGrantedByScepter || isGrantedByShard) ? description : null)
      if (!effectiveLore && !scepterDescription && !shardDescription && !isInnate) continue
      abilityLoreMap.set(ab.id, {
        id: ab.id,
        name: ab.name,
        displayName: ab.language?.displayName || ab.name,
        iconUrl: `${ABILITY_IMG}/${ab.name}.png`,
        lore: effectiveLore,
        description,
        scepterDescription,
        shardDescription,
        hasScepter,
        hasShard,
        isGrantedByScepter,
        isGrantedByShard,
        isInnate,
      })
    }

    heroes.value = data.heroes
      .filter(h => h.displayName && h.shortName)
      .map(h => mapHero(h, abilityLoreMap, talentMap))
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
