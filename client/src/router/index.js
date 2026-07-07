import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'search',
    component: () => import('../views/SearchView.vue'),
  },
  {
    path: '/player',
    name: 'player',
    component: () => import('../views/PlayerView.vue'),
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('../views/FavoritesView.vue'),
  },
  {
    path: '/playlists',
    name: 'playlists',
    component: () => import('../views/PlaylistsView.vue'),
  },
  {
    path: '/playlists/:id',
    name: 'playlist-detail',
    component: () => import('../views/PlaylistsView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
