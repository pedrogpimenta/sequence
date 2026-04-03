<template>
  <!-- Lobby -->
  <div v-if="phase === 'lobby'" class="overlay">
    <h2>SEQUENCE — Online</h2>

    <div class="lobby-form" v-if="!lobbyStep">
      <div class="setup-field">
        <label>Your name</label>
        <input v-model="myName" type="text" maxlength="20" placeholder="Your name" @keydown.enter="lobbyStep = 'choose'" />
      </div>
      <button class="big-btn" @click="lobbyStep = 'choose'" :disabled="!myName.trim()">Continue ▶</button>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'choose'">
      <p style="text-align:center;opacity:0.8">Playing as <strong>{{ myName }}</strong></p>
      <div class="lobby-btns">
        <button class="big-btn" @click="createRoom">Create Room</button>
        <button class="big-btn" style="background:#1155cc" @click="lobbyStep = 'join'">Join Room</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'join'">
      <div class="setup-field">
        <label>Room code</label>
        <input
          v-model="roomCodeInput"
          type="text" maxlength="4" placeholder="XXXX"
          style="text-transform:uppercase;letter-spacing:4px;font-size:1.3em;text-align:center"
          @keydown.enter="joinRoom"
        />
      </div>
      <div class="lobby-btns">
        <button class="big-btn" @click="joinRoom" :disabled="roomCodeInput.length < 4">Join ▶</button>
        <button class="back-link" @click="lobbyStep = 'choose'">← Back</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'waiting'">
      <div class="room-code-display">{{ roomCode }}</div>
      <p style="text-align:center">Share this code with your opponent.<br>Waiting for them to join…</p>
      <div class="spinner"></div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'reconnecting'">
      <p style="text-align:center;opacity:0.8">Rejoining room <strong>{{ roomCodeInput.toUpperCase() }}</strong> as <strong>{{ myName }}</strong>…</p>
      <div class="spinner"></div>
      <button class="back-link" @click="cancelReconnect">Cancel</button>
    </div>

    <div v-if="lobbyError" class="error-msg">{{ lobbyError }}</div>
    <button class="ghost-btn" @click="goBack">← Back to Menu</button>
  </div>

  <!-- Connection lost (hard disconnect — server gone) -->
  <div v-else-if="phase === 'disconnected'" class="overlay">
    <h2>Connection Lost</h2>
    <p>{{ disconnectMsg }}</p>
    <p style="font-size:0.85em;opacity:0.6">Rejoin with code <strong>{{ roomCode }}</strong> and your name to resume.</p>
    <button class="big-btn" @click="goBack">Back to Menu</button>
  </div>

  <!-- Game over -->
  <div v-if="phase === 'play' && gameState?.over" class="overlay">
    <h2>{{ gameState.names[gameState.winner] }} Wins!</h2>
    <p>Congratulations — 2 sequences completed!</p>
    <button class="big-btn" @click="goBack">Back to Menu</button>
  </div>

  <!-- Mobile menu drawer -->
  <div v-if="menuOpen" class="menu-veil" @click.self="menuOpen = false">
    <div class="menu-drawer">
      <button class="drawer-close" @click="menuOpen = false">✕</button>
      <div class="room-code-row" v-if="roomCode">
        <span class="room-code-label">Room code</span>
        <span class="room-code-pill">{{ roomCode }}</span>
      </div>
      <div class="legend-text">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>
      <p class="deck-note" v-if="gameState">Deck: {{ gameState.deckCount }} cards remaining</p>
      <p class="deck-note" v-if="gameState">Opponent's hand: {{ gameState.oppHandCount }} cards</p>
      <button class="ghost-btn sm" @click="goBack">← Leave Game</button>
    </div>
  </div>

  <!-- Opponent disconnected banner (non-blocking) -->
  <div v-if="phase === 'play' && oppDisconnected" class="opp-disconnected-banner">
    ⚠️ Opponent disconnected — waiting for them to rejoin with code <strong>{{ roomCode }}</strong>
  </div>

  <!-- Game UI -->
  <div v-if="phase === 'play' && gameState" class="gw">

    <!-- ① Mobile top bar -->
    <div class="topbar">
      <span class="sc" :class="myIndex === 0 ? 's0' : 's1'">{{ gameState.names[myIndex] }} {{ gameState.seqs[myIndex] }}/2</span>
      <span class="tc" :class="isMyTurn ? 'active' : 'wait'">
        {{ isMyTurn ? '▶ Your turn' : '⏳ Waiting…' }}
      </span>
      <span class="sc" :class="myIndex === 0 ? 's1' : 's0'">{{ gameState.names[1 - myIndex] }} {{ gameState.seqs[1 - myIndex] }}/2</span>
      <button class="menu-btn" @click="menuOpen = true">☰</button>
    </div>

    <!-- ② Board -->
    <div class="bc">
      <GameBoard
        :board="gameState.board"
        :locked="gameState.locked"
        :validSet="highlightSet"
        :removeSet="removeTargetSet"
        @cell-click="onCellClick"
      />
    </div>

    <!-- ③ Right panel -->
    <div class="rp">

      <!-- Desktop only: room code -->
      <div class="d-roomcode" v-if="roomCode">
        <div class="d-roomcode-label">Room code</div>
        <div class="room-code-pill d-roomcode-pill">{{ roomCode }}</div>
      </div>

      <!-- Desktop only: scores + status + deck -->
      <div class="d-scores">
        <div class="seq-badge" :class="myIndex === 0 ? 's0' : 's1'">{{ gameState.names[myIndex] }} (you) — {{ gameState.seqs[myIndex] }} / 2</div>
        <div class="seq-badge" :class="myIndex === 0 ? 's1' : 's0'">{{ gameState.names[1 - myIndex] }} — {{ gameState.seqs[1 - myIndex] }} / 2</div>
      </div>
      <div class="d-status" :class="isMyTurn ? 'my-turn' : 'their-turn'">
        {{ isMyTurn ? '🟢 Your turn' : `⏳ Waiting for ${gameState.names[1 - myIndex]}…` }}
      </div>
      <div class="d-deck">
        Cards in deck: <strong>{{ gameState.deckCount }}</strong> &nbsp;·&nbsp;
        Opponent: <strong>{{ gameState.oppHandCount }}</strong> cards
      </div>

      <!-- Shared: message -->
      <div class="msg-box">{{ message }}</div>

      <!-- Desktop only: hand label -->
      <div class="d-label">— Your hand —</div>

      <!-- Shared: hand -->
      <div class="hc">
        <PlayerHand
          :cards="gameState.myHand"
          :selCard="isMyTurn ? gameState.selCard : null"
          :actionTaken="isMyTurn ? gameState.actionTaken : true"
          :gameState="localStateForDead"
          @select="onSelectCard"
        />
      </div>

      <!-- Shared: buttons -->
      <div class="btn-row">
        <button v-if="isMyTurn && gameState.selCard !== null && !gameState.actionTaken" class="btn-gray"   @click="send({ type: 'cancel_sel' })">Cancel</button>
        <button v-if="isMyTurn && showDiscard"                                          class="btn-orange" @click="send({ type: 'discard_dead' })">Discard</button>
        <button v-if="isMyTurn && gameState.actionTaken"                                class="btn-purple" @click="send({ type: 'undo_action' })">Undo</button>
        <button class="btn-red" @click="send({ type: 'end_turn' })" :disabled="!isMyTurn || !gameState.actionTaken">Confirm</button>
      </div>

      <!-- Desktop only: legend + leave -->
      <div class="d-legend">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>
      <div class="d-newgame">
        <button class="btn-dark w100" @click="goBack">← Leave Game</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const menuOpen       = ref(false)
const oppDisconnected = ref(false)

let ws = null

const LS_KEY = 'sequence_online_session'
function saveSession()  { localStorage.setItem(LS_KEY, JSON.stringify({ name: myName.value, code: roomCode.value })) }
function clearSession() { localStorage.removeItem(LS_KEY) }

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws`
}

function connect() {
  ws = new WebSocket(getWsUrl())
  ws.onmessage = (ev) => { try { handleMsg(JSON.parse(ev.data)) } catch (_) {} }
  ws.onclose   = () => {
    if (phase.value === 'play' && gameState.value && !gameState.value.over) {
      disconnectMsg.value = 'The connection to the server was lost.'
      phase.value = 'disconnected'
    }
  }
  ws.onerror = () => {
    if (lobbyStep.value === 'reconnecting') { clearSession(); lobbyStep.value = '' }
    lobbyError.value = 'Cannot connect to server.'
  }
}

function handleMsg(msg) {
  lobbyError.value = ''
  if (msg.type === 'room_created') {
    roomCode.value = msg.code; myIndex.value = msg.playerIndex; lobbyStep.value = 'waiting'
    saveSession()
  } else if (msg.type === 'game_start' || msg.type === 'game_resume' || msg.type === 'state_update') {
    if (msg.type === 'game_start' || msg.type === 'game_resume') {
      // Capture room code if we joined (P2 doesn't get room_created)
      if (!roomCode.value) roomCode.value = roomCodeInput.value.toUpperCase()
      oppDisconnected.value = false
      phase.value = 'play'
      saveSession()
    }
    applyState(msg)
  } else if (msg.type === 'opponent_disconnected') {
    oppDisconnected.value = true
    message.value = `Opponent disconnected. Waiting for them to rejoin with code ${roomCode.value}…`
  } else if (msg.type === 'opponent_reconnected') {
    oppDisconnected.value = false
    updateMessage()
  } else if (msg.type === 'error') {
    if (lobbyStep.value === 'reconnecting') {
      clearSession(); lobbyStep.value = ''
    }
    lobbyError.value = msg.message
  }
}

function applyState(msg) {
  gameState.value = { board: msg.board, locked: msg.locked, seqs: msg.seqs, deckCount: msg.deckCount, myHand: msg.myHand, oppHandCount: msg.oppHandCount, cur: msg.cur, selCard: msg.selCard, mode: msg.mode, actionTaken: msg.actionTaken, over: msg.over, winner: msg.winner, names: msg.names, myIndex: msg.myIndex }
  myIndex.value = msg.myIndex
  updateMessage()
}

function updateMessage() {
  const gs = gameState.value
  if (!gs) return
  if (gs.over)                      { message.value = `${gs.names[gs.winner]} wins!`; return }
  if (!isMyTurn.value)              { message.value = `Waiting for ${gs.names[1 - myIndex.value]}…`; return }
  if (gs.actionTaken)               { message.value = 'Action done — press Confirm to end your turn.'; return }
  if (gs.selCard !== null) {
    const card = gs.myHand[gs.selCard]
    message.value = isOneEye(card) ? 'One-eyed Jack — click an opponent chip.' : `${card} selected — click a highlighted space.`
    return
  }
  message.value = 'Your turn — select a card.'
}

function send(obj) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
}

function createRoom() {
  if (!myName.value.trim()) return
  connect(); ws.onopen = () => send({ type: 'create_room', name: myName.value.trim() })
}

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length < 4) return
  connect(); ws.onopen = () => send({ type: 'join_room', code, name: myName.value.trim() })
}

function onSelectCard(idx) {
  if (!isMyTurn.value || gameState.value?.actionTaken) return
  send({ type: 'select_card', cardIndex: idx })
}

function onCellClick(r, c) {
  if (!isMyTurn.value || gameState.value?.selCard === null) return
  send({ type: 'place_chip', row: r, col: c })
}

function goBack() { clearSession(); if (ws) ws.close(); ws = null; router.push('/') }

function cancelReconnect() {
  clearSession()
  if (ws) { ws.onclose = null; ws.close(); ws = null }
  lobbyStep.value = ''
  myName.value = ''
  roomCodeInput.value = ''
}

const isMyTurn = computed(() => gameState.value?.cur === myIndex.value)

const localStateForDead = computed(() => {
  const gs = gameState.value
  if (!gs) return null
  return { board: gs.board, locked: gs.locked, cur: myIndex.value, hands: myIndex.value === 0 ? [gs.myHand, []] : [[], gs.myHand] }
})

const highlightSet = computed(() => {
  const gs = gameState.value
  if (!gs || !isMyTurn.value || gs.selCard === null || gs.mode === 'remove') return new Set()
  const s = { board: gs.board, locked: gs.locked, cur: myIndex.value }
  return new Set(validPositions(s, gs.myHand[gs.selCard]).map(([r,c]) => `${r},${c}`))
})

const removeTargetSet = computed(() => {
  const gs = gameState.value
  if (!gs || !isMyTurn.value || gs.selCard === null || gs.mode !== 'remove') return new Set()
  const s = { board: gs.board, locked: gs.locked, cur: myIndex.value }
  return new Set(validPositions(s, gs.myHand[gs.selCard]).map(([r,c]) => `${r},${c}`))
})

const showDiscard = computed(() => {
  const gs = gameState.value
  if (!gs || gs.selCard === null || gs.actionTaken) return false
  return isDead({ board: gs.board, locked: gs.locked, cur: myIndex.value }, gs.myHand[gs.selCard])
})

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (saved?.name && saved?.code) {
      myName.value = saved.name
      roomCodeInput.value = saved.code
      lobbyStep.value = 'reconnecting'
      connect()
      ws.onopen = () => send({ type: 'join_room', code: saved.code.toUpperCase(), name: saved.name })
    }
  } catch (_) {}
})

onUnmounted(() => { if (ws) ws.close() })
</script>

<style scoped>
/* ─── Layout shell ────────────────────────────────────────────────────────── */
.gw {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

/* ─── Mobile top bar ──────────────────────────────────────────────────────── */
.topbar {
  flex-shrink: 0;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  background: rgba(0,0,0,0.35);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.sc {
  font-size: 0.76em;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.sc.s0 { background: #1155cc; }
.sc.s1 { background: #cc1111; }
.tc {
  flex: 1;
  text-align: center;
  font-size: 0.8em;
  font-weight: bold;
  padding: 3px 6px;
  border-radius: 10px;
}
.tc.active { background: rgba(39,174,96,0.5); }
.tc.wait   { background: rgba(255,255,255,0.1); opacity: 0.75; }
.menu-btn {
  background: rgba(255,255,255,0.1);
  color: white; border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px; padding: 5px 10px; font-size: 1em; cursor: pointer; flex-shrink: 0;
}

/* ─── Board area ──────────────────────────────────────────────────────────── */
.bc {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
}
.bc :deep(#board-wrapper) {
  width:  min(100vw, calc(100dvh - 212px));
  height: min(100vw, calc(100dvh - 212px));
  border: none;
  padding: 3px;
}

/* ─── Right panel ─────────────────────────────────────────────────────────── */
.rp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #1a3d28;
  border-top: 2px solid rgba(255,255,255,0.1);
}

.d-scores, .d-status, .d-deck, .d-label, .d-legend, .d-newgame { display: none; }

.msg-box {
  order: 1;
  padding: 5px 12px;
  font-size: 0.82em;
  line-height: 1.3;
  min-height: 28px;
  background: rgba(255,255,255,0.08);
  margin: 5px 8px 0;
  border-radius: 6px;
}

.btn-row {
  order: 2;
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 5px 8px;
}
.btn-row button { padding: 8px 14px; font-size: 0.88em; border-radius: 6px; color: white; }

.hc { order: 3; padding: 5px 6px 8px; }

/* ─── Button colors ───────────────────────────────────────────────────────── */
.btn-gray   { background: #7f8c8d; }
.btn-orange { background: #e67e22; }
.btn-purple { background: #8e44ad; }
.btn-red    { background: #e74c3c; }
.btn-dark   { background: #555; color: white; }
.w100       { width: 100%; }

/* ─── Desktop (≥768px) ───────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .gw { flex-direction: row; height: 100vh; }

  .topbar { display: none; }

  .bc { flex-shrink: 0; background: transparent; align-items: stretch; justify-content: stretch; }
  .bc :deep(#board-wrapper) {
    height: 100vh; width: auto; aspect-ratio: 1/1;
    border-right: 3px solid #333; padding: 4px; background: #111;
  }

  .rp {
    flex: 1; overflow-y: auto; height: 100vh;
    padding: 18px 20px; gap: 14px;
    background: transparent; border-top: none;
  }

  .d-scores { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .d-status {
    display: block; text-align: center; font-weight: bold; font-size: 1.05em;
    padding: 8px 16px; border-radius: 8px;
  }
  .d-status.my-turn    { background: rgba(39,174,96,0.3); border: 1px solid #27ae60; }
  .d-status.their-turn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); }
  .d-deck  { display: block; text-align: center; font-size: 0.9em; opacity: 0.75; }
  .d-label { display: block; text-align: center; font-size: 1em; opacity: 0.8; }
  .d-legend {
    display: block; font-size: 0.78em; opacity: 0.65; line-height: 1.7;
    border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px;
  }
  .d-newgame {
    display: flex; flex-direction: column; gap: 8px;
    border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px;
  }

  .seq-badge { padding: 5px 14px; border-radius: 20px; font-weight: bold; font-size: 0.88em; }
  .seq-badge.s0 { background: #1155cc; }
  .seq-badge.s1 { background: #cc1111; }

  .msg-box { order: 0; background: rgba(255,255,255,0.13); border-radius: 8px; padding: 10px 14px; font-size: 0.92em; line-height: 1.4; min-height: 44px; margin: 0; }
  .hc      { order: 0; padding: 0; }
  .btn-row { order: 0; flex-wrap: wrap; padding: 4px 0; }
  .btn-row button { padding: 11px 22px; font-size: 1em; }
}

/* ─── Overlays ────────────────────────────────────────────────────────────── */
.overlay {
  position: fixed; inset: 0; background: #000;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 200; gap: 20px; overflow-y: auto; padding: 20px;
}
.overlay h2  { font-size: 2.2em; }
.overlay > p { font-size: 1.05em; opacity: 0.8; text-align: center; max-width: 360px; }

.big-btn {
  padding: 14px 40px; font-size: 1.15em;
  background: #27ae60; color: white; border-radius: 9px;
  font-family: inherit; font-weight: bold; cursor: pointer; border: none;
}
.big-btn:hover { background: #229954; }
.ghost-btn {
  background: transparent; color: rgba(255,255,255,0.6);
  font-size: 0.95em; padding: 8px 20px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-family: inherit;
}
.ghost-btn.sm { font-size: 0.9em; }

.lobby-form  { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 340px; align-items: center; }
.setup-field { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.setup-field label { font-size: 0.95em; opacity: 0.8; }
.setup-field input {
  padding: 10px 14px; border-radius: 7px; outline: none;
  border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1);
  color: white; font-size: 1.05em; font-family: inherit;
}
.setup-field input:focus       { border-color: rgba(255,255,255,0.6); }
.setup-field input::placeholder { opacity: 0.4; }
.lobby-btns  { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.back-link   { background: transparent; color: rgba(255,255,255,0.6); border: none; font-size: 0.9em; cursor: pointer; text-decoration: underline; padding: 4px; }

.room-code-display {
  font-size: 3em; font-weight: bold; letter-spacing: 12px;
  background: rgba(255,255,255,0.1); padding: 18px 32px;
  border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); text-align: center;
}
.error-msg {
  color: #ff6b6b; background: rgba(255,0,0,0.1);
  border: 1px solid rgba(255,0,0,0.3); border-radius: 8px;
  padding: 10px 20px; font-size: 0.95em; text-align: center; max-width: 340px;
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid rgba(255,255,255,0.2); border-top-color: white;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Opponent disconnected banner ───────────────────────────────────────── */
.opp-disconnected-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  background: #c0392b;
  color: white;
  font-size: 0.85em;
  text-align: center;
  padding: 8px 16px;
  line-height: 1.4;
}

/* ─── Room code pill ──────────────────────────────────────────────────────── */
.room-code-pill {
  font-family: monospace;
  font-size: 1.1em;
  letter-spacing: 3px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 6px;
  padding: 2px 10px;
}
.room-code-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0 4px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 4px;
}
.room-code-label { font-size: 0.82em; opacity: 0.65; }

/* Desktop room code in sidebar */
.d-roomcode {
  display: none;
}
@media (min-width: 768px) {
  .d-roomcode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 0 12px;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }
  .d-roomcode-label {
    font-size: 0.75em;
    opacity: 0.55;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .d-roomcode-pill {
    font-size: 1.6em !important;
    letter-spacing: 6px !important;
    padding: 6px 18px !important;
    background: rgba(255,255,255,0.15) !important;
    border-color: rgba(255,255,255,0.3) !important;
  }
}

/* ─── Mobile menu drawer ──────────────────────────────────────────────────── */
.menu-veil {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 300;
  display: flex; flex-direction: column; justify-content: flex-end;
}
.menu-drawer {
  background: #1e3a2a; border-radius: 16px 16px 0 0;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 14px;
  position: relative;
}
.drawer-close {
  position: absolute; top: 14px; right: 16px;
  background: rgba(255,255,255,0.1); color: white; border: none;
  border-radius: 50%; width: 30px; height: 30px; font-size: 0.9em; cursor: pointer;
}
.legend-text { font-size: 0.85em; line-height: 1.8; opacity: 0.85; }
.deck-note   { font-size: 0.82em; opacity: 0.55; }
</style>
