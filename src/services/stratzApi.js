const ENDPOINT = 'https://api.stratz.com/graphql'

const HEROES_QUERY = `{
  constants {
    heroes {
      id
      name
      displayName
      shortName
      aliases
      roles {
        roleId
        level
      }
      language {
        lore
        hype
        displayName
      }
      stats {
        primaryAttribute
        attackType
        complexity
        startingDamageMin
        startingDamageMax
        attackRate
        attackRange
        startingArmor
        startingMagicArmor
        hpRegen
        moveSpeed
      }
      abilities {
        slot
        abilityId
      }
    }
    abilities {
      id
      name
      isTalent
      language {
        displayName
        description
        lore
        aghanimDescription
        shardDescription
      }
      stat {
        hasScepterUpgrade
        isGrantedByScepter
        hasShardUpgrade
        isGrantedByShard
        isInnate
        isOnLearnbar
      }
    }
  }
}`


export async function fetchStratzHeroes() {
  const token = import.meta.env.VITE_STRATZ_TOKEN
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: HEROES_QUERY }),
  })

  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  const json = await resp.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  return json.data.constants
}
