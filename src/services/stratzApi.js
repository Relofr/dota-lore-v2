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
        mpRegen
        moveSpeed
        moveTurnRate
        strengthBase
        strengthGain
        agilityBase
        agilityGain
        intelligenceBase
        intelligenceGain
        visionDaytimeRange
        visionNighttimeRange
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



async function stratzQuery(query) {
  const token = import.meta.env.VITE_STRATZ_TOKEN
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const resp = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const json = await resp.json().catch(() => null)
  if (json?.errors?.length) throw new Error(json.errors.map(e => e.message).join(' | '))
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  return json.data
}

export async function introspectType(typeName) {
  return stratzQuery(`{ __type(name: "${typeName}") { fields { name args { name type { name kind ofType { name } } } type { name kind ofType { name kind } } } } }`)
}

export async function testLiveMatches() {
  return stratzQuery(`{
    live {
      matches(request: { take: 3 }) {
        matchId
        gameState
        gameMinute
        players {
          steamAccountId
          steamAccount { name }
        }
      }
    }
  }`)
}

export async function introspectInput(typeName) {
  return stratzQuery(`{ __type(name: "${typeName}") { inputFields { name type { name kind ofType { name } } } } }`)
}

export async function testLiveArgs() {
  // Try to get the args for live.match via full introspection
  return stratzQuery(`{
    __type(name: "LiveQuery") {
      fields {
        name
        args {
          name
          defaultValue
          type { name kind ofType { name kind } }
        }
      }
    }
  }`)
}

let itemsPromise = null

export function fetchItems() {
  itemsPromise ??= stratzQuery(`{
    constants { items { id shortName displayName stat { isRecipe } } }
  }`)
    .then(data => new Map(data.constants.items.map(i => [i.id, i])))
    .catch(err => {
      itemsPromise = null
      throw err
    })
  return itemsPromise
}

// Event-level data for finer-than-a-minute charts; it covers the whole match (~2 MB), so it's loaded separately.
export async function fetchMatchPlayback(matchId) {
  const data = await stratzQuery(`{
    match(id: ${matchId}) {
      players {
        playerSlot
        playbackData {
          playerUpdateGoldEvents { time networth }
          experienceEvents { time amount }
          heroDamageEvents { time value isTargetMainHero toIllusion }
          csEvents { time }
        }
      }
    }
  }`)
  return data.match?.players ?? []
}

export async function fetchMatchPlayers(matchId) {
  const data = await stratzQuery(`{
    match(id: ${matchId}) {
      id
      startDateTime
      durationSeconds
      didRadiantWin
      topLaneOutcome
      midLaneOutcome
      bottomLaneOutcome
      firstBloodTime
      radiantNetworthLeads
      radiantExperienceLeads
      radiantKills
      direKills
      towerDeaths { time isRadiant }
      players {
        steamAccountId
        playerSlot
        isRadiant
        heroId
        item0Id
        item1Id
        item2Id
        item3Id
        item4Id
        item5Id
        backpack0Id
        backpack1Id
        backpack2Id
        neutral0Id
        kills
        deaths
        assists
        numLastHits
        numDenies
        goldPerMinute
        experiencePerMinute
        networth
        level
        heroDamage
        lane
        position
        stats {
          lastHitsPerMinute
          deniesPerMinute
          goldPerMinute
          experiencePerMinute
          networthPerMinute
          heroDamagePerMinute
          level
          killEvents { time target isSolo isGank }
          deathEvents { time attacker goldFed timeDead }
          assistEvents { time }
          itemPurchases { time itemId }
        }
        hero {
          displayName
          shortName
        }
        steamAccount {
          id
          name
          avatar
        }
      }
    }
  }`)
  return data.match ?? null
}

export async function fetchLiveMatch(matchId) {
  const data = await stratzQuery(`{
    live {
      match(id: ${matchId}) {
        matchId
        gameState
        gameTime
        gameMinute
        players {
          steamAccountId
          heroId
          isRadiant
          numKills
          numDeaths
          numAssists
          networth
          goldPerMinute
          experiencePerMinute
          steamAccount {
            id
            name
            avatar
          }
          hero {
            displayName
            shortName
          }
        }
      }
    }
  }`)
  return data.live?.match ?? null
}

const RANKED_LOBBY = 7

export async function fetchPlayerMatches(steamAccountId, skip, take = 10) {
  const data = await stratzQuery(`{
    player(steamAccountId: ${steamAccountId}) {
      matches(request: { take: ${take}, skip: ${skip}, lobbyTypeIds: [${RANKED_LOBBY}] }) {
        id
        didRadiantWin
        durationSeconds
        startDateTime
        players(steamAccountId: ${steamAccountId}) {
          isRadiant
          heroId
          kills
          deaths
          assists
          position
          hero { displayName shortName }
        }
      }
    }
  }`)
  return data.player?.matches ?? []
}

export const PERIOD_PAGE_SIZE = 100

function threeMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return Math.floor(d.getTime() / 1000)
}

const periodFields = id => `
        didRadiantWin
        players(steamAccountId: ${id}) {
          isRadiant
          heroId
          hero { displayName shortName }
        }`

export async function fetchRankedPeriodPage(steamAccountId, skip) {
  const data = await stratzQuery(`{
    player(steamAccountId: ${steamAccountId}) {
      matches(request: { startDateTime: ${threeMonthsAgo()}, take: ${PERIOD_PAGE_SIZE}, skip: ${skip}, lobbyTypeIds: [${RANKED_LOBBY}] }) {${periodFields(steamAccountId)}
      }
    }
  }`)
  return data.player?.matches ?? []
}

export async function fetchPlayersData(steamAccountIds) {
  const since = threeMonthsAgo()
  const blocks = steamAccountIds.map(id => `
    p${id}: player(steamAccountId: ${id}) {
      steamAccount { name avatar isAnonymous seasonRank seasonLeaderboardRank }
      anyMatch: matches(request: { take: 1 }) { id }
      recentPeriod: matches(request: { startDateTime: ${since}, take: ${PERIOD_PAGE_SIZE}, lobbyTypeIds: [${RANKED_LOBBY}] }) {${periodFields(id)}
      }
      matches(request: { take: 10, lobbyTypeIds: [${RANKED_LOBBY}] }) {
        id
        didRadiantWin
        durationSeconds
        startDateTime
        players(steamAccountId: ${id}) {
          isRadiant
          heroId
          kills
          deaths
          assists
          position
          hero { displayName shortName }
        }
      }
    }`).join('\n')
  const data = await stratzQuery(`{ ${blocks} }`)
  const result = {}
  for (const id of steamAccountIds) result[id] = data[`p${id}`] ?? null
  return result
}

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
