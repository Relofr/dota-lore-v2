import { reactive } from 'vue'

// App-wide toasts, shown top right by AppToasts.vue. Kept at module level so any view can raise one.
const toasts = reactive([])
let nextId = 1

export function dismissToast(id) {
  const i = toasts.findIndex(t => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

// Shows `message` for `duration` ms. A message already on screen isn't stacked again; its timer restarts.
export function showToast(message, { type = 'error', duration = 6000 } = {}) {
  const existing = toasts.find(t => t.message === message)
  if (existing) {
    clearTimeout(existing.timer)
    existing.timer = setTimeout(() => dismissToast(existing.id), duration)
    return
  }
  const id = nextId++
  toasts.push({ id, message, type, timer: setTimeout(() => dismissToast(id), duration) })
}

export function useToasts() {
  return toasts
}
