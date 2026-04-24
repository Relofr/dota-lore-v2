import { ref, onUnmounted } from 'vue'

export function useSpeech() {
  const speaking = ref(false)
  const paused  = ref(false)
  const loading = ref(false)

  let audio     = null
  let objectUrl = null

  function cleanup() {
    if (audio) {
      audio.pause()
      audio.src = ''
      audio = null
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
    speaking.value = false
    paused.value   = false
    loading.value  = false
  }

  async function speak(text) {
    cleanup()
    loading.value = true

    try {
      const resp = await fetch(import.meta.env.VITE_POLLY_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!resp.ok) {
        const msg = await resp.text()
        throw new Error(`Polly worker ${resp.status}: ${msg}`)
      }

      const blob = await resp.blob()
      objectUrl  = URL.createObjectURL(blob)
      audio      = new Audio(objectUrl)

      audio.onplay  = () => { speaking.value = true;  loading.value = false }
      audio.onended = () => { speaking.value = false; paused.value  = false }
      audio.onpause = () => { if (!audio.ended) paused.value = true }
      audio.onerror = () => cleanup()

      await audio.play()
    } catch (err) {
      console.error('TTS error:', err)
      cleanup()
    }
  }

  function toggle(text) {
    if (loading.value) return
    if (!speaking.value && !paused.value) {
      speak(text)
    } else if (paused.value) {
      audio?.play()
      paused.value = false
    } else {
      audio?.pause()
    }
  }

  window.addEventListener('beforeunload', cleanup)
  onUnmounted(() => {
    cleanup()
    window.removeEventListener('beforeunload', cleanup)
  })

  return { speaking, paused, loading, supported: true, toggle, stop: cleanup }
}
