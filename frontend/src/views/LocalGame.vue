<template>
  <!-- Setup overlay -->
  <div v-if="phase === 'setup'" class="overlay">
    <h2>SEQUENCE</h2>
    <p style="margin-top:-10px;font-size:0.95em">Enter player names to begin</p>
    <div class="setup-form">
      <div class="setup-field">
        <label><span class="player-dot p0"></span>Player 1 (blue chips)</label>
        <input v-model="name0" type="text" maxlength="20" placeholder="Player 1" @keydown.enter="startGame" />
      </div>
      <div class="setup-field">
        <label><span class="player-dot p1"></span>Player 2 (red chips)</label>
        <input v-model="name1" type="text" maxlength="20" placeholder="Player 2" @keydown.enter="startGame" />
      </div>
      <button class="big-btn" @click="startGame">Start Game ▶</button>
    </div>
    <button class="back-btn" @click="router.push('/')">← Back</button>
  </div>

  <!-- Turn overlay -->
  <div v-else-if="phase === 'turn'" class="overlay">
    <h2>{{ state.names[state.cur] }}'s Turn</h2>
    <p>Pass the device to {{ state.names[state.cur] }}, then tap below.</p>
    <button class="big-btn" @click="phase = 'play'; setMsg()">My Turn ▶</button>
  </div>

  <!-- Game over overlay -->
  <div v-else-if="phase === 'over'" class="overlay">
    <h2>{{ state.names[state.winner] }} Wins!</h2>
    <p>Congratulations — 2 sequences completed!</p>
    <button class="big-btn" @click="resetToSetup">Play Again</button>
    <button class="back-btn" @click="router.push('/')">← Main Menu</button>
  </div>

  <!-- Confirm new game overlay -->
  <div v-if="showConfirm" class="overlay" style="background:rgba(0,0,0,0.75)">
    <div class="confirm-box">
      <h3>Start a new game?</h3>
      <p>The current game will be lost.</p>
      <div class="confirm-btns">
        <button style="background:#7f8c8d;color:white" @click="showConfirm=false">Cancel</button>
        <button style="background:#e74c3c;color:white" @click="confirmNewGame">New Game</button>
      </div>
    </div>
  </div>

  <!-- Game UI -->
  <div v-if="phase === 'play'" class="game-layout">
    <GameBoard
      :board="state.board"
      :locked="state.locked"
      :validSet="highlightSet"
      :removeSet="removeTargetSet"
      @cell-click="onCellClick"
    />

    <div id="sidebar">
      <h1>SEQUENCE</h1>

      <div id="scores">
        <div class="seq-badge p0">{{ state.names[0] }} — {{ state.seqs[0] }} / 2</div>
        <div class="seq-badge p1">{{ state.names[1] }} — {{ state.seqs[1] }} / 2</div>
      </div>

      <div id="deck-info">Cards in deck: <strong>{{ state.deck.length }}</strong></div>

      <div id="message">{{ message }}</div>

      <div id="hand-label">— {{ state.names[state.cur] }}'s hand —</div>
      <PlayerHand
        :cards="state.hands[state.cur]"
        :selCard="state.selCard"
        :actionTaken="state.actionTaken"
        :gameState="state"
        @select="onSelectCard"
      />

      <div id="buttons">
        <button v-if="state.selCard !== null && !state.actionTaken" @click="onCancel" style="background:#7f8c8d;color:white">Cancel</button>
        <button v-if="showDiscard" @click="onDiscard" style="background:#e67e22;color:white">Discard Dead</button>
        <button v-if="state.actionTaken" @click="onUndo" style="background:#8e44ad;color:white">Undo</button>
        <button @click="onEndTurn" :disabled="!state.actionTaken" style="background:#e74c3c;color:white">Confirm</button>
      </div>

      <div id="legend">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>

      <div id="new-game-area">
        <button @click="requestNewGame" style="background:#27ae60;color:white;width:100%">New Game</button>
        <button @click="router.push('/')" style="background:#555;color:white;width:100%;margin-top:8px">← Main Menu</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import GameBoard from '../components/GameBoard.vue'
import PlayerHand from '../components/PlayerHand.vue'
import {
  buildInitialState, validPositions, isDead,
  localSelectCard, localCellClick, localDiscardDead,
  localCancelSel, localUndo, localEndTurn,
  isOneEye,
} from '../game/gameLogic.js'

const router = useRouter()
const SAVE_KEY = 'sequence_save_local'

const phase = ref('setup')
const name0 = ref('')
const name1 = ref('')
const message = ref('')
const showConfirm = ref(false)

// Try to restore saved game
let savedState = null
try { savedState = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch (_) {}

const state = reactive(savedState && !savedState.over ? savedState : buildInitialState('Player 1', 'Player 2'))

if (savedState) {
  if (savedState.over) {
    phase.value = 'over'
  } else {
    phase.value = 'turn'
  }
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch (_) {}
}

function setMsg() {
  if (state.actionTaken) {
    message.value = 'Action done — press Confirm to end your turn.'
  } else {
    message.value = `${state.names[state.cur]}'s turn — select a card.`
  }
}

function startGame() {
  const n0 = name0.value.trim() || 'Player 1'
  const n1 = name1.value.trim() || 'Player 2'
  Object.assign(state, buildInitialState(n0, n1))
  save()
  phase.value = 'turn'
}

function resetToSetup() {
  localStorage.removeItem(SAVE_KEY)
  name0.value = ''
  name1.value = ''
  phase.value = 'setup'
}

function requestNewGame() {
  if (!state.over) {
    showConfirm.value = true
  } else {
    resetToSetup()
  }
}

function confirmNewGame() {
  showConfirm.value = false
  localStorage.removeItem(SAVE_KEY)
  name0.value = state.names[0]
  name1.value = state.names[1]
  phase.value = 'setup'
}

const highlightSet = computed(() => {
  if (state.selCard === null || state.mode === 'remove') return new Set()
  const card = state.hands[state.cur][state.selCard]
  return new Set(validPositions(state, card).map(([r, c]) => `${r},${c}`))
})

const removeTargetSet = computed(() => {
  if (state.selCard === null || state.mode !== 'remove') return new Set()
  const card = state.hands[state.cur][state.selCard]
  return new Set(validPositions(state, card).map(([r, c]) => `${r},${c}`))
})

const showDiscard = computed(() => {
  if (state.selCard === null || state.actionTaken) return false
  return isDead(state, state.hands[state.cur][state.selCard])
})

function onSelectCard(idx) {
  localSelectCard(state, idx)
  const card = state.hands[state.cur][idx]
  if (isOneEye(card)) message.value = 'One-eyed Jack — click an opponent chip to remove it.'
  else message.value = `${card} selected — click a highlighted space.`
  save()
}

function onCellClick(r, c) {
  localCellClick(state, r, c)
  save()
  if (state.over) {
    phase.value = 'over'
  } else if (state.actionTaken) {
    message.value = 'Action done — press Confirm to end your turn.'
  }
}

function onDiscard() {
  localDiscardDead(state)
  save()
  message.value = 'Dead card discarded. Press Confirm to end your turn.'
}

function onCancel() {
  localCancelSel(state)
  setMsg()
  save()
}

function onUndo() {
  localUndo(state)
  save()
  setMsg()
}

function onEndTurn() {
  localEndTurn(state)
  save()
  phase.value = 'turn'
}
</script>

<style scoped>
.game-layout {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
}

#sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  gap: 14px;
  height: 100vh;
  overflow-y: auto;
  min-width: 0;
}

h1 { font-size: 1.9em; letter-spacing: 3px; text-shadow: 2px 2px 6px rgba(0,0,0,.5); text-align: center; }

#scores { display: flex; gap: 10px; justify-content: center; }
.seq-badge {
  padding: 5px 18px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.95em;
}
.seq-badge.p0 { background: #1155cc; }
.seq-badge.p1 { background: #cc1111; }

#deck-info { text-align: center; font-size: 0.9em; opacity: 0.75; }

#message {
  background: rgba(255,255,255,.13);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.92em;
  line-height: 1.4;
  min-height: 44px;
}

#hand-label { font-size: 1em; opacity: 0.8; text-align: center; }

#buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: auto;
  padding-top: 4px;
}

#legend {
  font-size: 0.78em;
  opacity: 0.65;
  line-height: 1.7;
  border-top: 1px solid rgba(255,255,255,.15);
  padding-top: 8px;
}

#new-game-area {
  border-top: 1px solid rgba(255,255,255,.15);
  padding-top: 12px;
}

/* overlays */
.overlay {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  gap: 22px;
}
.overlay h2 { font-size: 2.2em; }
.overlay p  { font-size: 1.1em; opacity: 0.8; text-align: center; max-width: 340px; }

.big-btn {
  padding: 15px 44px;
  font-size: 1.25em;
  background: #27ae60;
  color: white;
  border-radius: 9px;
}
.big-btn:hover { background: #229954; }

.back-btn {
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 0.95em;
  padding: 8px 20px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 7px;
}

.setup-form { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 340px; }
.setup-field { display: flex; flex-direction: column; gap: 6px; }
.setup-field label { font-size: 0.95em; opacity: 0.8; letter-spacing: 0.5px; }
.setup-field input {
  padding: 10px 14px;
  border-radius: 7px;
  border: 2px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.1);
  color: white;
  font-size: 1.05em;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
}
.setup-field input::placeholder { opacity: 0.4; }
.setup-field input:focus { border-color: rgba(255,255,255,.6); }

.player-dot {
  display: inline-block;
  width: 12px; height: 12px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.player-dot.p0 { background: radial-gradient(circle at 35% 35%, #7eb3ff, #1144bb); }
.player-dot.p1 { background: radial-gradient(circle at 35% 35%, #ff9999, #bb1111); }

.confirm-box {
  background: #1e3a2a;
  border: 2px solid rgba(255,255,255,.2);
  border-radius: 12px;
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 360px;
  width: 90%;
}
.confirm-box h3 { font-size: 1.4em; }
.confirm-box p  { font-size: 0.95em; opacity: 0.75; text-align: center; }
.confirm-btns   { display: flex; gap: 12px; }
</style>
