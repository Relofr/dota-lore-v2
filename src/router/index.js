import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import HeroesView from '@/views/HeroesView.vue'
import HeroDetailView from '@/views/HeroDetailView.vue'
import ScoutView from '@/views/ScoutView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/heroes', component: HeroesView },
    { path: '/heroes/:id', component: HeroDetailView },
    // /scout/<laning|full-game>/<lane>/<matchId>, every part optional (the lane is left out for the summary).
    // One route for all of them, so moving between matches doesn't remount the page.
    { path: '/scout/:view(laning|full-game)?/:section(top|mid|bottom|roaming)?/:matchId(\\d+)?', component: ScoutView },
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (to.path.startsWith('/heroes') && savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

export default router
