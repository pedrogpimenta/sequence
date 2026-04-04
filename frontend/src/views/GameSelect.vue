<template>
  <div class="game-select">
    <h1 class="title">🃏 Juegos de Cartas</h1>
    <p class="subtitle">Elegí tu juego</p>
    <div class="game-buttons">
      <button class="game-btn seq-btn" @click="router.push('/sequence')">
        <span class="game-icon">⬡</span>
        <span class="game-title">SEQUENCE</span>
        <span class="game-desc">Formá 5 en línea<br>con tus fichas</span>
      </button>
      <button class="game-btn truco-btn" @click="router.push('/truco')">
        <span class="game-icon">♠</span>
        <span class="game-title">TRUCO</span>
        <span class="game-desc">Truco Argentino<br>online o local</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped>
.game-select {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.title {
  font-size: 2.6em;
  letter-spacing: 3px;
  text-shadow: 2px 2px 10px rgba(0,0,0,0.5);
}

.subtitle {
  font-size: 1.1em;
  opacity: 0.65;
  margin-top: -20px;
}

.game-buttons {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  justify-content: center;
}

.game-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 210px;
  height: 190px;
  border-radius: 18px;
  border: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  padding: 28px 20px;
  color: white;
  font-family: inherit;
}
.game-btn:hover { transform: translateY(-5px); box-shadow: 0 10px 28px rgba(0,0,0,0.45); }

.seq-btn   { background: linear-gradient(145deg, #1155cc, #0d3d99); border: 2px solid #3070e0; }
.truco-btn { background: linear-gradient(145deg, #7b1c00, #c23000); border: 2px solid #e85000; }

.game-icon  { font-size: 2.8em; line-height: 1; }
.game-title { font-size: 1.5em; font-weight: bold; letter-spacing: 2px; }
.game-desc  { font-size: 0.78em; opacity: 0.75; text-align: center; line-height: 1.5; }
</style>
