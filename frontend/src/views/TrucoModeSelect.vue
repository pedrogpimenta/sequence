<template>
  <div class="mode-select">
    <h1>TRUCO</h1>
    <p class="subtitle">Truco Argentino — elegí cómo jugar</p>

    <div class="player-count">
      <button :class="['count-btn', numPlayers === 2 ? 'active' : '']" @click="numPlayers = 2">2 jugadores</button>
      <button :class="['count-btn', numPlayers === 4 ? 'active' : '']" @click="numPlayers = 4">4 jugadores</button>
    </div>

    <div class="mode-buttons">
      <button class="mode-btn local-btn" @click="router.push(`/truco/local?players=${numPlayers}`)">
        <span class="mode-icon">🖥️</span>
        <span class="mode-title">Local</span>
        <span class="mode-desc">Un dispositivo,<br>pasalo de mano en mano</span>
      </button>
      <button class="mode-btn online-btn" @click="router.push(`/truco/online?players=${numPlayers}`)">
        <span class="mode-icon">🌐</span>
        <span class="mode-title">Online</span>
        <span class="mode-desc">Jugá por la red</span>
      </button>
    </div>
    <div class="legend">
      <strong>Mazo:</strong> 40 cartas españolas (1–7, 10–12) •
      <strong>Gana:</strong> primero en llegar a 30 puntos •
      Envido + Truco por cada mano
    </div>
    <button class="ghost-btn" @click="router.push('/')">← Volver</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
const numPlayers = ref(2)
</script>

<style scoped>
.mode-select {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

h1 {
  font-size: 3.5em;
  letter-spacing: 6px;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.5);
  color: #ff6b35;
}

.subtitle {
  font-size: 1.05em;
  opacity: 0.7;
  margin-top: -18px;
}

.player-count {
  display: flex;
  gap: 10px;
}

.count-btn {
  padding: 8px 22px;
  border-radius: 20px;
  border: 2px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.6);
  font-family: inherit;
  font-size: 0.9em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
}
.count-btn.active {
  background: #c23000;
  border-color: #ff6b35;
  color: white;
}
.count-btn:hover:not(.active) {
  border-color: rgba(255,255,255,0.4);
  color: rgba(255,255,255,0.9);
}

.mode-buttons {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 200px;
  height: 160px;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  padding: 24px 20px;
  color: white;
  font-family: inherit;
}
.mode-btn:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

.local-btn  { background: #7b1c00; border: 2px solid #c23000; }
.online-btn { background: #7b3e00; border: 2px solid #c25e00; }

.mode-icon  { font-size: 2.4em; }
.mode-title { font-size: 1.4em; font-weight: bold; letter-spacing: 1px; }
.mode-desc  { font-size: 0.8em; opacity: 0.75; text-align: center; }

.legend {
  font-size: 0.78em;
  opacity: 0.55;
  text-align: center;
  max-width: 520px;
  line-height: 1.7;
}

.ghost-btn {
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 0.95em;
  padding: 8px 20px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
  font-family: inherit;
}
</style>
