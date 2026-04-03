import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import ModeSelect from './views/ModeSelect.vue'
import LocalGame from './views/LocalGame.vue'
import OnlineGame from './views/OnlineGame.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',       component: ModeSelect },
    { path: '/local',  component: LocalGame  },
    { path: '/online', component: OnlineGame },
  ],
})

createApp(App).use(router).mount('#app')
