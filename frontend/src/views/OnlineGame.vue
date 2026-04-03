<template>
  <!-- Lobby -->
  <div v-if="phase === 'lobby'" class="overlay">
    <h2>SEQUENCE — Online</h2>

    <div class="lobby-form" v-if="!lobbyStep">
      <div class="setup-field">
        <label>Your name</label>
        <input v-model="myName" type="text" maxlength="20" placeholder="Your name" @keydown.enter="lobbyStep='choose'" />
      </div>
      <div class="lobby-btns">
        <button class="big-btn" @click="lobbyStep='choose'" :disabled="!myName.trim()">Continue ▶</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'choose'">
      <p style="text-align:center;opacity:0.8">Playing as <strong>{{ myName }}</strong></p>
      <div class="lobby-btns">
        <button class="big-btn" @click="createRoom">Create Room</button>
        <button class="big-btn" style="background:#1155cc" @click="lobbyStep='join'">Join Room</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'join'">
      <div class="setup-field">
        <label>Room code</label>
        <input
          v-model="roomCodeInput"
          type="text"
          maxlength="4"
          placeholder="XXXX"
          style="text-transform:uppercase;letter-spacing:4px;font-size:1.3em;text-align:center"
          @keydown.enter="joinRoom"
        />
      </div>
      <div class="lobby-btns">
        <button class="big-btn" @click="joinRoom" :disabled="roomCodeInput.length < 4">Join ▶</button>
        <button class="back-link" @click="lobbyStep='choose'">← Back</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'waiting'">
      <div class="room-code-display">{{ roomCode }}</div>
      <p style="text-align:center">Share this code with your opponent.<br>Waiting for them to join…</p>
      <div class="spinner"></div>
    </div>

    <div v-if="lobbyError" class="error-msg">{{ lobbyError }}</div>

    <button class="back-btn" @click="goBack">← Back to Menu</button>
  </div>

  <!-- Disconnected overlay -->
  <div v-else-if="phase === 'disconnected'" class="overlay">
    <h2>Disconnected</h2>
    <p>{{ disconnectMsg }}</p>
    <button class="big-btn" @click="goBack">Back to Menu</button>
  </div>

  <!-- Game over overlay -->
  <div v-if="phase === 'play' && gameState && gameState.over" class="overlay">
    <h2>{{ gameState.names[gameState.winner] }} Wins!</h2>
    <p>Congratulations — 2 sequences completed!</p>
    <button class="big-btn" @click="goBack">Back to Menu</button>
  </div>

  <!-- Game UI -->
  <div v-if="phase === 'play' && gameState" class="game-layout">
    <GameBoard
      :board="gameState.board"
      :locked="gameState.locked"
      :validSet="highlightSet"
      :removeSet="removeTargetSet"
      @cell-click="onCellClick"
    />

    <div id="sidebar">
      <h1>SEQUENCE</h1>

      <div class="online-status" :class="isMyTurn ? 'my-turn' : 'their-turn'">
        {{ isMyTurn ? '🟢 Your turn' : `⏳ Waiting for ${gameState.names[1 - myIndex]}…` }}
      </div>

      <div id="scores">
        <div class="seq-badge" :class="myIndex === 0 ? 'p0' : 'p1'">
          {{ gameState.names[myIndex] }} (you) — {{ gameState.seqs[myIndex] }} / 2
        </div>
        <div class="seq-badge" :class="myIndex === 0 ? 'p1' : 'p0'">
          {{ gameState.names[1 - myIndex] }} — {{ gameState.seqs[1 - myIndex] }} / 2
        </div>
      </div>

      <div id="deck-info">Cards in deck: <strong>{{ gameState.deckCount }}</strong></div>

      <div id="message">{{ message }}</div>

      <div id="hand-label">— Your hand —</div>
      <PlayerHand
        :cards="gameState.myHand"
        :selCard="isMyTurn ? gameState.selCard : null"
        :actionTaken="isMyTurn ? gameState.actionTaken : true"
        :gameState="localStateForDead"
        @select="onSelectCard"
      />

      <div id="opp-info">
        Opponent's hand: <strong>{{ gameState.oppHandCount }}</strong> cards
      </div>

      <div id="buttons">
        <button
          v-if="isMyTurn && gameState.selCard !== null && !gameState.actionTaken"
          @click="send({ type: 'cancel_sel' })"
          style="background:#7f8c8d;color:white"
        >Cancel</button>
        <button
          v-if="isMyTurn && showDiscard"
          @click="send({ type: 'discard_dead' })"
          style="background:#e67e22;color:white"
        >Discard Dead</button>
        <button
          v-if="isMyTurn && gameState.actionTaken"
          @click="send({ type: 'undo_action' })"
          style="background:#8e44ad;color:white"
        >Undo</button>
        <button
          @click="send({ type: 'end_turn' })"
          :disabled="!isMyTurn || !gameState.actionTaken"
          style="background:#e74c3c;color:white"
        >Confirm Turn</button>
      </div>

      <div id="legend">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>

      <div id="new-game-area">
        <button @click="goBack" style="background:#555;color:white;width:100%">← Main Menu</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GameBoard from '../components/GameBoard.vue'
import PlayerHand from '../components/PlayerHand.vue'
import { validPositions, isDead, isOneEye } from '../game/gameLogic.js'

const router = useRouter()

const phase          = ref('lobby')
const lobbyStep      = ref('')
const myName         = ref('')
const roomCode       = ref('')
const roomCodeInput  = ref('')
const lobbyError     = ref('')
const myIndex        = ref(null)
const gameState      = ref(null)
const message        = ref('')
const disconnectMsg  = ref('Your opponent disconnected.')

let ws = null

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

function connect() {
  ws = new WebSocket(getWsUrl())

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    handleServerMsg(msg)
  }

  ws.onclose = () => {
    if (phase.value === 'play' && gameState.value && !gameState.value.over) {
      disconnectMsg.value = 'Connection lost.'
      phase.value = 'disconnected'
    }
  }

  ws.onerror = () => {
    lobbyError.value = 'Cannot connect to server.'
  }
}

function handleServerMsg(msg) {
  lobbyError.value = ''

  switch (msg.type) {
    case 'room_created':
      roomCode.value = msg.code
      myIndex.value  = msg.playerIndex
      lobbyStep.value = 'waiting'
      break

    case 'game_start':
    case 'state_update':
      applyState(msg)
      if (msg.type === 'game_start') phase.value = 'play'
      break

    case 'opponent_disconnected':
      disconnectMsg.value = 'Your opponent disconnected.'
      phase.value = 'disconnected'
      break

    case 'error':
      lobbyError.value = msg.message
      break
  }
}

function applyState(msg) {
  gameState.value = {
    board:        msg.board,
    locked:       msg.locked,
    seqs:         msg.seqs,
    deckCount:    msg.deckCount,
    myHand:       msg.myHand,
    oppHandCount: msg.oppHandCount,
    cur:          msg.cur,
    selCard:      msg.selCard,
    mode:         msg.mode,
    actionTaken:  msg.actionTaken,
    over:         msg.over,
    winner:       msg.winner,
    names:        msg.names,
    myIndex:      msg.myIndex,
  }
  myIndex.value = msg.myIndex
  updateMessage()
}

function updateMessage() {
  const gs = gameState.value
  if (!gs) return
  if (gs.over) { message.value = `${gs.names[gs.winner]} wins!`; return }
  if (!isMyTurn.value) { message.value = `Waiting for ${gs.names[1 - myIndex.value]}…`; return }
  if (gs.actionTaken) { message.value = 'Action done — press Confirm to end your turn.'; return }
  if (gs.selCard !== null) {
    const card = gs.myHand[gs.selCard]
    if (isOneEye(card)) message.value = 'One-eyed Jack — click an opponent chip to remove it.'
    else message.value = `${card} selected — click a highlighted space.`
    return
  }
  message.value = 'Your turn — select a card from your hand.'
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

function createRoom() {
  if (!myName.value.trim()) return
  connect()
  ws.onopen = () => send({ type: 'create_room', name: myName.value.trim() })
}

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length < 4) return
  connect()
  ws.onopen = () => send({ type: 'join_room', code, name: myName.value.trim() })
}

function onSelectCard(idx) {
  if (!isMyTurn.value || gameState.value?.actionTaken) return
  send({ type: 'select_card', cardIndex: idx })
}

function onCellClick(r, c) {
  if (!isMyTurn.value || gameState.value?.selCard === null) return
  send({ type: 'place_chip', row: r, col: c })
}

function goBack() {
  if (ws) ws.close()
  ws = null
  router.push('/')
}

const isMyTurn = computed(() => {
  return gameState.value != null && gameState.value.cur === myIndex.value
})

// Build a minimal state object for isDead checks in PlayerHand
const localStateForDead = computed(() => {
  const gs = gameState.value
  if (!gs) return null
  return {
    board:  gs.board,
    locked: gs.locked,
    cur:    myIndex.value,
    hands:  myIndex.value === 0
      ? [gs.myHand, []]
      : [[], gs.myHand],
  }
})

const highlightSet = computed(() => {
  const gs = gameState.value
  if (!gs || !isMyTurn.value || gs.selCard === null || gs.mode === 'remove') return new Set()
  const card = gs.myHand[gs.selCard]
  const s = { board: gs.board, locked: gs.locked, cur: myIndex.value }
  return new Set(validPositions(s, card).map(([r, c]) => `${r},${c}`))
})

const removeTargetSet = computed(() => {
  const gs = gameState.value
  if (!gs || !isMyTurn.value || gs.selCard === null || gs.mode !== 'remove') return new Set()
  const card = gs.myHand[gs.selCard]
  const s = { board: gs.board, locked: gs.locked, cur: myIndex.value }
  return new Set(validPositions(s, card).map(([r, c]) => `${r},${c}`))
})

const showDiscard = computed(() => {
  const gs = gameState.value
  if (!gs || gs.selCard === null || gs.actionTaken) return false
  const s = { board: gs.board, locked: gs.locked, cur: myIndex.value }
  return isDead(s, gs.myHand[gs.selCard])
})

onUnmounted(() => {
  if (ws) ws.close()
})
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
  gap: 12px;
  height: 100vh;
  overflow-y: auto;
  min-width: 0;
}

h1 { font-size: 1.9em; letter-spacing: 3px; text-shadow: 2px 2px 6px rgba(0,0,0,.5); text-align: center; }

.online-status {
  text-align: center;
  font-weight: bold;
  font-size: 1.05em;
  padding: 8px 16px;
  border-radius: 8px;
}
.my-turn    { background: rgba(39,174,96,0.3); border: 1px solid #27ae60; }
.their-turn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); }

#scores { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.seq-badge {
  padding: 5px 14px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.88em;
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
#opp-info   { text-align: center; font-size: 0.85em; opacity: 0.6; }

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
.overlay > p { font-size: 1.1em; opacity: 0.8; text-align: center; max-width: 360px; }

.lobby-form { display: flex; flex-direction: column; gap: 18px; width: 100%; max-width: 340px; }
.setup-field { display: flex; flex-direction: column; gap: 6px; }
.setup-field label { font-size: 0.95em; opacity: 0.8; }
.setup-field input {
  padding: 10px 14px;
  border-radius: 7px;
  border: 2px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.1);
  color: white;
  font-size: 1.05em;
  font-family: inherit;
  outline: none;
}
.setup-field input:focus { border-color: rgba(255,255,255,.6); }
.setup-field input::placeholder { opacity: 0.4; }

.lobby-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

.big-btn {
  padding: 15px 36px;
  font-size: 1.15em;
  background: #27ae60;
  color: white;
  border-radius: 9px;
  font-family: inherit;
  font-weight: bold;
}

.back-btn {
  background: transparent;
  color: rgba(255,255,255,0.6);
  font-size: 0.95em;
  padding: 8px 20px;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 7px;
}

.back-link {
  background: transparent;
  color: rgba(255,255,255,0.6);
  border: none;
  font-size: 0.9em;
  cursor: pointer;
  text-decoration: underline;
  padding: 4px;
}

.room-code-display {
  font-size: 3em;
  font-weight: bold;
  letter-spacing: 12px;
  background: rgba(255,255,255,0.1);
  padding: 18px 32px;
  border-radius: 12px;
  border: 2px solid rgba(255,255,255,0.2);
  text-align: center;
}

.error-msg {
  color: #ff6b6b;
  background: rgba(255,0,0,0.1);
  border: 1px solid rgba(255,0,0,0.3);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 0.95em;
  text-align: center;
  max-width: 340px;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(255,255,255,0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
