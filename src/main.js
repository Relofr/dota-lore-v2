import { createApp } from 'vue'
// Self-hosted UI font (served with the app, no third-party request); see --font-ui in App.vue.
import '@fontsource-variable/inter'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

router.isReady().then(() => app.mount('#app'))
