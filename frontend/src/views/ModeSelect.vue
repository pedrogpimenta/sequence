<template>
  <div class="mode-select">
    <h1>SEQUENCE</h1>
    <p class="subtitle">Choose how to play</p>
    <div class="mode-buttons">
      <button class="mode-btn local-btn" @click="router.push('/local')">
        <span class="mode-icon">🖥️</span>
        <span class="mode-title">Local</span>
        <span class="mode-desc">Two players, one device</span>
      </button>
      <button class="mode-btn online-btn" @click="router.push('/online')">
        <span class="mode-icon">🌐</span>
        <span class="mode-title">Online</span>
        <span class="mode-desc">Play over the network</span>
      </button>
    </div>
    <div class="legend">
      <strong>Jacks:</strong>
      J♥ J♠ = one-eyed → remove opponent chip &nbsp;|&nbsp;
      J♦ J♣ = two-eyed → place chip anywhere<br>
      <strong>Win:</strong> first to 2 sequences (5 in a row). FREE corners count as wild for both players.
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style scoped>
.mode-select {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

h1 {
  font-size: 3.5em;
  letter-spacing: 6px;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.5);
}

.subtitle {
  font-size: 1.1em;
  opacity: 0.7;
  margin-top: -18px;
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
}
.mode-btn:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }

.local-btn  { background: #1155cc; }
.online-btn { background: #2e7d32; border: 2px solid #4caf50; }

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
</style>
