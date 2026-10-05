// Persistent browser cache for finished-match data, which never changes once Stratz has parsed it.
// IndexedDB rather than localStorage: playback data is ~2 MB per match, past localStorage's quota.
// Records live in `data`; `meta` holds just { key, kind, at } so pruning never loads the big records.

const DB_NAME = 'dota-lore'
const DB_VERSION = 1
// Most entries kept per kind; the least recently used go first.
const LIMITS = { match: 100, playback: 25 }

let dbPromise = null

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('data')
      db.createObjectStore('meta', { keyPath: 'key' }).createIndex('kind', 'kind')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch(err => {
    dbPromise = null
    throw err
  })
  return dbPromise
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function result(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Storage problems (private mode, quota, blocked) only cost a refetch, so they never throw.
export async function getStored(kind, id) {
  try {
    const db = await openDb()
    const key = `${kind}:${id}`
    const tx = db.transaction(['data', 'meta'], 'readwrite')
    const value = await result(tx.objectStore('data').get(key))
    if (value !== undefined) tx.objectStore('meta').put({ key, kind, at: Date.now() })
    await done(tx)
    return value
  } catch (err) {
    console.warn('[matchStore] read failed:', err.message)
    return undefined
  }
}

export async function putStored(kind, id, value) {
  try {
    const db = await openDb()
    const key = `${kind}:${id}`
    const tx = db.transaction(['data', 'meta'], 'readwrite')
    tx.objectStore('data').put(value, key)
    tx.objectStore('meta').put({ key, kind, at: Date.now() })
    await done(tx)
    await prune(db, kind)
  } catch (err) {
    console.warn('[matchStore] write failed:', err.message)
  }
}

async function prune(db, kind) {
  const limit = LIMITS[kind] ?? Infinity
  const tx = db.transaction(['data', 'meta'], 'readwrite')
  const metas = await result(tx.objectStore('meta').index('kind').getAll(kind))
  if (metas.length > limit) {
    metas.sort((a, b) => a.at - b.at)
    for (const { key } of metas.slice(0, metas.length - limit)) {
      tx.objectStore('data').delete(key)
      tx.objectStore('meta').delete(key)
    }
  }
  await done(tx)
}
