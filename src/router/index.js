import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HeroesView from '@/views/HeroesView.vue'
import HeroDetailView from '@/views/HeroDetailView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/heroes', component: HeroesView },
    { path: '/heroes/:id', component: HeroDetailView },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.path.startsWith('/heroes') && savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

export default router
