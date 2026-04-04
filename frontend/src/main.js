import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import GameSelect from './views/GameSelect.vue'
import ModeSelect from './views/ModeSelect.vue'
import LocalGame from './views/LocalGame.vue'
import OnlineGame from './views/OnlineGame.vue'
import TrucoModeSelect from './views/TrucoModeSelect.vue'
import TrucoLocalGame from './views/TrucoLocalGame.vue'
import TrucoOnlineGame from './views/TrucoOnlineGame.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',               component: GameSelect      },
    { path: '/sequence',       component: ModeSelect      },
    { path: '/sequence/local', component: LocalGame       },
    { path: '/sequence/online',component: OnlineGame      },
    { path: '/truco',          component: TrucoModeSelect },
    { path: '/truco/local',    component: TrucoLocalGame  },
    { path: '/truco/online',   component: TrucoOnlineGame },
    // Keep legacy routes for backward compat (direct links)
    { path: '/local',  redirect: '/sequence/local'  },
    { path: '/online', redirect: '/sequence/online' },
  ],
})

createApp(App).use(router).mount('#app')
