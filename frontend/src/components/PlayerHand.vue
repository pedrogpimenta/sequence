<template>
  <div id="hand">
    <div
      v-for="(card, idx) in cards"
      :key="idx"
      class="hand-card"
      :class="[
        isRed(card) ? 'red-card' : 'black-card',
        isTwoEye(card) ? 'jack-wild' : '',
        isOneEye(card) ? 'jack-remove' : '',
        idx === selCard ? 'selected' : '',
        actionTaken ? 'action-done' : '',
        (!actionTaken && isDead(gameState, card) && idx !== selCard) ? 'dead' : '',
      ]"
      @click="!actionTaken && emit('select', idx)"
    >
      <div class="c-rank">{{ rank(card) }}</div>
      <div class="c-suit">{{ suitChar(card) }}</div>
      <div v-if="isOneEye(card)" class="jack-label">1-eye&#10;remove</div>
      <div v-else-if="isTwoEye(card)" class="jack-label">2-eye&#10;wild</div>
    </div>
  </div>
</template>

<script setup>
import { rank, suitChar, isRed, isOneEye, isTwoEye, isDead } from '../game/gameLogic.js'

defineProps({
  cards:       { type: Array,  required: true },
  selCard:     { type: Number, default: null  },
  actionTaken: { type: Boolean, default: false },
  gameState:   { type: Object, required: true },
})
const emit = defineEmits(['select'])
</script>

<style scoped>
#hand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.hand-card {
  width: 62px; height: 88px;
  background: white;
  border-radius: 7px;
  border: 2px solid #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.1s, border-color 0.1s, opacity 0.1s;
  user-select: none;
}
.hand-card:hover:not(.action-done) { transform: translateY(-6px); border-color: #888; }
.hand-card.selected  { border-color: #ffd700; border-width: 3px; transform: translateY(-10px); }
.hand-card.dead      { opacity: 0.45; }
.hand-card.action-done { cursor: default; opacity: 0.4; }
.hand-card.red-card    { color: #cc0000; }
.hand-card.black-card  { color: #111; }
.hand-card.jack-wild   { background: #fffde0; }
.hand-card.jack-remove { background: #ffeee8; }

.c-rank { font-size: 1.35em; line-height: 1.2; }
.c-suit { font-size: 1.15em; }
.jack-label {
  font-size: 0.46em;
  text-align: center;
  line-height: 1.2;
  color: #555;
  margin-top: 2px;
  white-space: pre;
}
</style>
