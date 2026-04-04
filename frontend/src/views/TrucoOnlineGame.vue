<template>
  <!-- Lobby -->
  <div v-if="phase === 'lobby'" class="overlay">
    <h2>TRUCO — Online</h2>

    <div class="lobby-form" v-if="!lobbyStep">
      <div class="setup-field">
        <label>Tu nombre</label>
        <input v-model="myName" type="text" maxlength="20" placeholder="Tu nombre" @keydown.enter="lobbyStep = 'choose'" />
      </div>
      <button class="big-btn" @click="lobbyStep = 'choose'" :disabled="!myName.trim()">Continuar ▶</button>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'choose'">
      <p style="text-align:center;opacity:0.8">Jugando como <strong>{{ myName }}</strong></p>
      <div class="lobby-btns">
        <button class="big-btn" @click="createRoom">Crear sala</button>
        <button class="big-btn" style="background:#7b3e00;border:2px solid #c25e00" @click="lobbyStep = 'join'">Unirse a sala</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'join'">
      <div class="setup-field">
        <label>Código de sala</label>
        <input v-model="roomCodeInput" type="text" maxlength="4" placeholder="XXXX"
          style="text-transform:uppercase;letter-spacing:4px;font-size:1.3em;text-align:center"
          @keydown.enter="joinRoom" />
      </div>
      <div class="lobby-btns">
        <button class="big-btn" @click="joinRoom" :disabled="roomCodeInput.length < 4">Unirse ▶</button>
        <button class="back-link" @click="lobbyStep = 'choose'">← Volver</button>
      </div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'waiting'">
      <div class="room-code-display">{{ roomCode }}</div>
      <p style="text-align:center">Compartí este código con tu oponente.<br>Esperando que se una…</p>
      <div class="spinner"></div>
    </div>

    <div class="lobby-form" v-else-if="lobbyStep === 'reconnecting'">
      <p style="text-align:center;opacity:0.8">Reconectando a sala <strong>{{ roomCodeInput.toUpperCase() }}</strong>…</p>
      <div class="spinner"></div>
      <button class="back-link" @click="cancelReconnect">Cancelar</button>
    </div>

    <div v-if="lobbyError" class="error-msg">{{ lobbyError }}</div>
    <button class="ghost-btn" @click="goBack">← Volver al menú</button>
  </div>

  <!-- Connection lost -->
  <div v-else-if="phase === 'disconnected'" class="overlay">
    <h2>Conexión perdida</h2>
    <p>{{ disconnectMsg }}</p>
    <button class="big-btn" @click="goBack">Volver al menú</button>
  </div>

  <!-- Hand result overlay -->
  <div v-if="phase === 'play' && gameState?.phase === 'hand_result'" class="overlay">
    <h2>Mano terminada</h2>
    <div class="result-body">
      <p class="result-winner"><strong>{{ gameState.handResult.winnerName }}</strong> ganó la mano</p>
      <div class="result-rows">
        <div class="result-row" v-if="gameState.handResult.trucoPoints > 0">
          <span>{{ gameState.handResult.trucoRejected ? 'No Quiero' : 'Truco' }}</span>
          <span>+{{ gameState.handResult.trucoPoints }} pts → {{ gameState.handResult.winnerName }}</span>
        </div>
        <div class="result-row" v-if="!gameState.handResult.trucoRejected && gameState.handResult.trucoPoints === 0">
          <span>Mano sin truco</span>
          <span>+1 pt → {{ gameState.handResult.winnerName }}</span>
        </div>
        <div class="result-row" v-if="gameState.handResult.envido">
          <span>Envido</span>
          <span>+{{ gameState.handResult.envido.points }} pts → {{ gameState.handResult.envido.winnerName }}</span>
        </div>
        <div class="result-row" v-if="gameState.handResult.envido?.scores">
          <span>Pts envido</span>
          <span>{{ gameState.names[0] }}: {{ gameState.handResult.envido.scores[0] }} — {{ gameState.names[1] }}: {{ gameState.handResult.envido.scores[1] }}</span>
        </div>
      </div>
      <div class="score-display">
        <div class="score-pill p0">{{ gameState.names[0] }}: {{ gameState.scores[0] }}/30</div>
        <div class="score-pill p1">{{ gameState.names[1] }}: {{ gameState.scores[1] }}/30</div>
      </div>
    </div>
    <button class="big-btn" @click="send({ type: 'next_hand' })">Siguiente mano ▶</button>
    <button class="ghost-btn" @click="goBack">← Salir</button>
  </div>

  <!-- Game over overlay -->
  <div v-if="phase === 'play' && gameState?.phase === 'game_over'" class="overlay">
    <h2>¡{{ gameState.names[gameState.winner] }} ganó!</h2>
    <p>Llegó a {{ gameState.scores[gameState.winner] }}/30 puntos</p>
    <div class="score-display">
      <div class="score-pill p0">{{ gameState.names[0] }}: {{ gameState.scores[0] }}</div>
      <div class="score-pill p1">{{ gameState.names[1] }}: {{ gameState.scores[1] }}</div>
    </div>
    <button class="big-btn" @click="goBack">Volver al menú</button>
  </div>

  <!-- Auto-reconnect banner -->
  <div v-if="autoReconnect" class="reconnect-banner">
    <span class="reconnect-spinner"></span> Conexión perdida — reconectando…
    <button class="reconnect-leave" @click="goBack">Salir</button>
  </div>

  <!-- Opponent disconnected banner -->
  <div v-if="phase === 'play' && oppDisconnected && !autoReconnect" class="opp-banner">
    ⚠ Oponente desconectado — esperando que vuelva con código <strong>{{ roomCode }}</strong>
  </div>

  <!-- Game UI -->
  <div v-if="phase === 'play' && gameState?.phase === 'playing'" class="gw">

    <!-- Mobile top bar -->
    <div class="topbar">
      <div class="tb-score">
        <span class="pts">{{ gameState.scores[myIndex] }}</span>
        {{ gameState.names[myIndex] }}
        <span v-if="gameState.mano === myIndex" class="mano-tag">Mano</span>
        (yo)
      </div>
      <div class="tb-turn" :class="isMyTurn ? 'active' : 'wait'">
        {{ isMyTurn ? '▶ Tu turno' : '⏳ Esperando…' }}
      </div>
      <div class="tb-score right">
        <span v-if="gameState.mano === (1-myIndex)" class="mano-tag">Mano</span>
        {{ gameState.names[1-myIndex] }}
        <span class="pts">{{ gameState.scores[1-myIndex] }}</span>
      </div>
    </div>

    <!-- Board area -->
    <div class="bc">

      <!-- Trick history -->
      <div class="trick-history">
        <div v-for="(result, i) in gameState.tricks" :key="i" class="trick-badge"
             :class="result === 'tie' ? 'tie' : result === myIndex ? 'mine' : 'theirs'">
          {{ i+1 }}: {{ result === 'tie' ? 'Parda' : gameState.names[result] }}
        </div>
        <div v-for="i in (3 - gameState.tricks.length)" :key="'e'+i" class="trick-badge empty">
          Truco {{ gameState.tricks.length + i }}
        </div>
      </div>

      <!-- Bet banner -->
      <div v-if="gameState.envido.pending" class="bet-banner envido-banner">
        <strong>{{ gameState.names[gameState.envido.calledBy] }}</strong> canta
        <strong>{{ ENVIDO_LEVEL_NAMES[gameState.envido.level] }}</strong>
        — vale {{ gameState.envido.value }} pts (no quiero: {{ gameState.envido.noQValue }})
      </div>
      <div v-else-if="gameState.truco.pending" class="bet-banner truco-banner">
        <strong>{{ gameState.names[gameState.truco.calledBy] }}</strong> canta
        <strong>{{ TRUCO_LEVEL_NAMES[gameState.truco.level] }}</strong>
        — vale {{ gameState.truco.value }} pts (no quiero: {{ gameState.truco.noQValue }})
      </div>
      <div v-else-if="gameState.envido.done && gameState.envido.winner !== null" class="bet-banner result-banner">
        Envido: <strong>{{ gameState.names[gameState.envido.winner] }}</strong> ganó {{ gameState.envido.points }} pts
        <template v-if="gameState.envido.scores"> ({{ gameState.envido.scores[0] }} vs {{ gameState.envido.scores[1] }})</template>
      </div>

      <!-- Table -->
      <div class="table">
        <div v-for="pi in [myIndex, 1-myIndex]" :key="pi" class="table-row">
          <div class="table-name" :class="{ 'active-p': gameState.cur === pi }">
            {{ gameState.names[pi] }}
            <span v-if="pi === myIndex"> (yo)</span>
            <span v-if="gameState.mano === pi" class="mano-dot">●</span>
          </div>
          <TrucoCard v-if="gameState.trickCards[pi]" :card="gameState.trickCards[pi]" />
          <div v-else class="card-slot">{{ gameState.cur === pi && !hasBetPending ? '▶' : '·' }}</div>
        </div>
      </div>

      <!-- Last trick -->
      <div v-if="gameState.lastTrickCards && gameState.tricks.length > 0" class="last-trick">
        <span class="lt-label">Último:</span>
        <TrucoCard :card="gameState.lastTrickCards[0]" :small="true" />
        <span class="vs">vs</span>
        <TrucoCard :card="gameState.lastTrickCards[1]" :small="true" />
        <span class="lt-res" :class="lastTrickResult === 'tie' ? 'tie' : 'win'">
          {{ lastTrickResult === 'tie' ? 'Parda' : '→ ' + gameState.names[lastTrickResult] }}
        </span>
      </div>

    </div>

    <!-- Right panel / Bottom panel -->
    <div class="rp">

      <!-- Desktop: room code -->
      <div class="d-roomcode" v-if="roomCode">
        <div class="d-roomcode-label">Código de sala</div>
        <div class="room-code-pill d-roomcode-pill">{{ roomCode }}</div>
      </div>

      <!-- Desktop: scores -->
      <div class="d-scores">
        <div class="score-pill" :class="myIndex === 0 ? 'p0' : 'p1'">
          {{ gameState.names[myIndex] }} (yo) — {{ gameState.scores[myIndex] }}/30
          <span v-if="gameState.mano === myIndex"> ●</span>
        </div>
        <div class="score-pill" :class="myIndex === 0 ? 'p1' : 'p0'">
          {{ gameState.names[1-myIndex] }} — {{ gameState.scores[1-myIndex] }}/30
          <span v-if="gameState.mano !== myIndex"> ●</span>
        </div>
      </div>

      <!-- Desktop: turn status -->
      <div class="d-status" :class="isMyTurn ? 'my-turn' : 'their-turn'">
        {{ isMyTurn ? '🟢 Tu turno' : `⏳ Esperando a ${gameState.names[1-myIndex]}…` }}
      </div>

      <!-- Desktop: trick history -->
      <div class="d-tricks">
        <div v-for="(result, i) in gameState.tricks" :key="i" class="trick-badge"
             :class="result === 'tie' ? 'tie' : result === myIndex ? 'mine' : 'theirs'">
          {{ i+1 }}: {{ result === 'tie' ? 'Parda' : gameState.names[result] }}
        </div>
        <div v-for="i in (3 - gameState.tricks.length)" :key="'e'+i" class="trick-badge empty">
          Truco {{ gameState.tricks.length + i }}
        </div>
      </div>

      <!-- Bet response (when it's my turn to respond) -->
      <div v-if="hasBetPending && iAmResponder" class="resp-area">
        <div class="resp-label">
          {{ gameState.names[betCalledBy] }} canta {{ currentBetName }}:
        </div>
        <div class="resp-btns">
          <button class="rb quiero" @click="send({ type: 'quiero' })">Quiero</button>
          <button class="rb noquiero" @click="send({ type: 'no_quiero' })">No Quiero</button>
          <template v-if="gameState.envido.pending">
            <button v-if="gameState.envido.level < 2" class="rb raise" @click="send({ type: 'call_envido' })">Envido</button>
            <button v-if="gameState.envido.level < 3" class="rb raise" @click="send({ type: 'call_real_envido' })">Real Envido</button>
            <button v-if="gameState.envido.level < 4" class="rb raise" @click="send({ type: 'call_falta_envido' })">Falta Envido</button>
          </template>
          <template v-if="gameState.truco.pending">
            <button v-if="gameState.truco.level === 1" class="rb raise" @click="send({ type: 'call_retruco' })">Retruco</button>
            <button v-if="gameState.truco.level === 2" class="rb raise" @click="send({ type: 'call_vale4' })">Vale Cuatro</button>
          </template>
        </div>
      </div>

      <!-- Call bets (on my play turn) -->
      <div v-else-if="isMyTurn && !hasBetPending" class="call-area">
        <template v-if="gameState.currentTrick === 0 && !gameState.envido.done">
          <button v-if="gameState.envido.level < 2" class="cb ev" @click="send({ type: 'call_envido' })">Envido</button>
          <button v-if="gameState.envido.level < 3" class="cb ev" @click="send({ type: 'call_real_envido' })">Real Envido</button>
          <button v-if="gameState.envido.level < 4" class="cb ev" @click="send({ type: 'call_falta_envido' })">Falta Envido</button>
        </template>
        <button v-if="!gameState.truco.done && !gameState.truco.pending" class="cb tr" @click="send({ type: 'call_truco' })">¡Truco!</button>
      </div>

      <!-- Hand -->
      <div class="hand-area">
        <div class="hand-label">— Tu mano —</div>
        <div class="hand-row">
          <TrucoCard
            v-for="(card, idx) in gameState.myHand"
            :key="idx"
            :card="card"
            :selected="selectedCard === idx"
            :clickable="canPlayCard && card !== null"
            @click="onCardClick(idx)"
          />
        </div>
        <div v-if="selectedCard !== null && canPlayCard" class="play-row">
          <button class="big-btn" @click="playSelected">Jugar carta ▶</button>
          <button class="ghost-btn" @click="selectedCard = null">Cancelar</button>
        </div>
        <div v-else-if="!isMyTurn" class="wait-msg">
          Esperando a {{ gameState.names[1-myIndex] }}…
        </div>
        <div v-else-if="hasBetPending && !iAmResponder" class="wait-msg">
          Esperando respuesta a {{ currentBetName }}…
        </div>
      </div>

      <!-- Desktop: opp hand count -->
      <div class="d-opp">Cartas del oponente: <strong>{{ gameState.oppHandCount }}</strong></div>

      <!-- Desktop: leave -->
      <div class="d-leave">
        <button class="btn-dark w100" @click="goBack">← Salir</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import TrucoCard from '../components/TrucoCard.vue'
import { ENVIDO_LEVEL_NAMES, TRUCO_LEVEL_NAMES } from '../game/trucoLogic.js'

const router = useRouter()

const phase          = ref('lobby')
const lobbyStep      = ref('')
const myName         = ref('')
const roomCode       = ref('')
const roomCodeInput  = ref('')
const lobbyError     = ref('')
const myIndex        = ref(null)
const gameState      = ref(null)
const oppDisconnected = ref(false)
const autoReconnect   = ref(false)
const disconnectMsg   = ref('Tu oponente se desconectó.')
const selectedCard    = ref(null)

let ws = null
let reconnectTimer = null

const LS_KEY = 'truco_online_session'
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
      startAutoReconnect()
    }
  }
  ws.onerror = () => {
    if (lobbyStep.value === 'reconnecting') { clearSession(); lobbyStep.value = '' }
    lobbyError.value = 'No se puede conectar al servidor.'
  }
}

function startAutoReconnect() { autoReconnect.value = true; scheduleReconnect() }
function stopAutoReconnect()  { autoReconnect.value = false; clearTimeout(reconnectTimer); reconnectTimer = null }

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(attemptReconnect, 3000)
}

function attemptReconnect() {
  if (!autoReconnect.value) return
  const name = myName.value, code = roomCode.value
  if (!name || !code) { stopAutoReconnect(); return }
  if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); ws = null }
  ws = new WebSocket(getWsUrl())
  ws.onmessage = (ev) => { try { handleMsg(JSON.parse(ev.data)) } catch (_) {} }
  ws.onopen    = () => send({ type: 'join_room', code, name, gameType: 'truco' })
  ws.onclose   = () => { if (autoReconnect.value) scheduleReconnect() }
  ws.onerror   = () => { if (autoReconnect.value) scheduleReconnect() }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && autoReconnect.value) {
    clearTimeout(reconnectTimer); attemptReconnect()
  }
}

function handleMsg(msg) {
  lobbyError.value = ''
  if (msg.type === 'room_created') {
    roomCode.value = msg.code; myIndex.value = msg.playerIndex; lobbyStep.value = 'waiting'
    saveSession()
  } else if (msg.type === 'game_start' || msg.type === 'game_resume' || msg.type === 'state_update') {
    if (msg.type === 'game_start' || msg.type === 'game_resume') {
      if (!roomCode.value) roomCode.value = roomCodeInput.value.toUpperCase()
      oppDisconnected.value = false
      phase.value = 'play'
      stopAutoReconnect()
      saveSession()
    }
    applyState(msg)
    selectedCard.value = null
  } else if (msg.type === 'opponent_disconnected') {
    oppDisconnected.value = true
  } else if (msg.type === 'opponent_reconnected') {
    oppDisconnected.value = false
  } else if (msg.type === 'error') {
    if (autoReconnect.value) {
      stopAutoReconnect(); disconnectMsg.value = msg.message; phase.value = 'disconnected'
    } else if (lobbyStep.value === 'reconnecting') {
      clearSession(); lobbyStep.value = ''
    }
    lobbyError.value = msg.message
  }
}

function applyState(msg) {
  gameState.value = {
    names: msg.names, scores: msg.scores,
    myHand: msg.myHand, oppHandCount: msg.oppHandCount,
    mano: msg.mano, currentTrick: msg.currentTrick,
    trickCards: msg.trickCards, lastTrickCards: msg.lastTrickCards,
    trickLeader: msg.trickLeader, trickCur: msg.trickCur,
    tricks: msg.tricks, envido: msg.envido, truco: msg.truco,
    cur: msg.cur, phase: msg.phase, handResult: msg.handResult,
    over: msg.over, winner: msg.winner, myIndex: msg.myIndex,
    handNumber: msg.handNumber,
  }
  myIndex.value = msg.myIndex
}

function send(obj) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
}

function createRoom() {
  if (!myName.value.trim()) return
  connect(); ws.onopen = () => send({ type: 'create_room', name: myName.value.trim(), gameType: 'truco' })
}

function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length < 4) return
  connect(); ws.onopen = () => send({ type: 'join_room', code, name: myName.value.trim(), gameType: 'truco' })
}

function goBack() {
  stopAutoReconnect(); clearSession()
  if (ws) ws.close(); ws = null
  router.push('/truco')
}

function cancelReconnect() {
  clearSession()
  if (ws) { ws.onclose = null; ws.close(); ws = null }
  lobbyStep.value = ''; myName.value = ''; roomCodeInput.value = ''
}

// ── Game actions ──────────────────────────────────────────────────────────────

function onCardClick(idx) {
  if (!canPlayCard.value) return
  if (gameState.value?.myHand[idx] === null) return
  selectedCard.value = selectedCard.value === idx ? null : idx
}

function playSelected() {
  if (selectedCard.value === null) return
  send({ type: 'play_card', cardIndex: selectedCard.value })
  selectedCard.value = null
}

// ── Computed ──────────────────────────────────────────────────────────────────

const isMyTurn = computed(() => gameState.value?.cur === myIndex.value)

const hasBetPending = computed(() =>
  gameState.value?.envido?.pending || gameState.value?.truco?.pending
)

const iAmResponder = computed(() => {
  const gs = gameState.value
  if (!gs) return false
  if (gs.envido?.pending && gs.envido.calledBy !== myIndex.value) return true
  if (gs.truco?.pending  && gs.truco.calledBy  !== myIndex.value) return true
  return false
})

const canPlayCard = computed(() =>
  isMyTurn.value && !hasBetPending.value &&
  gameState.value?.phase === 'playing' &&
  gameState.value?.cur === gameState.value?.trickCur
)

const betCalledBy = computed(() => {
  const gs = gameState.value
  if (!gs) return null
  if (gs.envido?.pending) return gs.envido.calledBy
  if (gs.truco?.pending)  return gs.truco.calledBy
  return null
})

const currentBetName = computed(() => {
  const gs = gameState.value
  if (!gs) return ''
  if (gs.envido?.pending) return ENVIDO_LEVEL_NAMES[gs.envido.level]
  if (gs.truco?.pending)  return TRUCO_LEVEL_NAMES[gs.truco.level]
  return ''
})

const lastTrickResult = computed(() => {
  const tricks = gameState.value?.tricks
  if (!tricks?.length) return null
  return tricks[tricks.length - 1]
})

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (saved?.name && saved?.code) {
      myName.value = saved.name
      roomCodeInput.value = saved.code
      lobbyStep.value = 'reconnecting'
      connect()
      ws.onopen = () => send({ type: 'join_room', code: saved.code.toUpperCase(), name: saved.name, gameType: 'truco' })
    }
  } catch (_) {}
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopAutoReconnect()
  if (ws) ws.close()
})
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.gw {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: #070f09;
}

/* ── Mobile top bar ───────────────────────────────────────────────────────── */
.topbar {
  flex-shrink: 0;
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 6px;
  background: rgba(0,0,0,0.5);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.tb-score {
  font-size: 0.72em;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.tb-score.right { justify-content: flex-end; }
.pts { font-size: 1.1em; color: #ffc850; }
.mano-tag {
  font-size: 0.65em; background: #f5c518; color: #000;
  padding: 1px 4px; border-radius: 3px; font-weight: bold;
}
.mano-dot { color: #f5c518; font-size: 0.7em; }
.tb-turn {
  flex: 0 0 auto;
  font-size: 0.73em;
  font-weight: bold;
  padding: 3px 8px;
  border-radius: 8px;
  text-align: center;
}
.tb-turn.active { background: rgba(39,174,96,0.4); }
.tb-turn.wait   { background: rgba(255,255,255,0.1); opacity: 0.7; }

/* ── Board center area ────────────────────────────────────────────────────── */
.bc {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Trick history — mobile only */
.trick-history {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.trick-badge {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.72em;
  font-weight: bold;
}
.trick-badge.mine   { background: rgba(30,80,200,0.6); }
.trick-badge.theirs { background: rgba(180,20,20,0.6); }
.trick-badge.tie    { background: rgba(160,130,0,0.6); }
.trick-badge.empty  { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); }

.bet-banner {
  text-align: center;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.82em;
}
.envido-banner { background: rgba(0,80,180,0.35); border: 1px solid #0055b3; }
.truco-banner  { background: rgba(140,0,0,0.35);  border: 1px solid #990000; }
.result-banner { background: rgba(0,100,0,0.35);  border: 1px solid #007700; }

.table {
  background: rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-row { display: flex; align-items: center; gap: 10px; }
.table-name {
  width: 100px;
  font-size: 0.8em;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(255,255,255,0.7);
}
.table-name.active-p { color: #7fff9d; }
.card-slot {
  width: 54px; height: 78px;
  border: 2px dashed rgba(255,255,255,0.12);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3em; color: rgba(255,255,255,0.15);
}

.last-trick {
  display: flex; align-items: center; gap: 7px;
  font-size: 0.75em; opacity: 0.6; flex-wrap: wrap;
}
.lt-label { color: rgba(255,255,255,0.4); }
.vs { opacity: 0.4; }
.lt-res.win { color: #7fff9d; }
.lt-res.tie { color: #f5c518; }

/* ── Right / Bottom panel ─────────────────────────────────────────────────── */
.rp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: rgba(0,0,0,0.3);
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 8px 10px;
}

/* Desktop-only elements hidden on mobile */
.d-roomcode, .d-scores, .d-status, .d-tricks, .d-opp, .d-leave { display: none; }

.resp-area { display: flex; flex-direction: column; gap: 5px; align-items: center; }
.resp-label { font-size: 0.77em; opacity: 0.65; }
.resp-btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.rb {
  padding: 8px 14px; border-radius: 7px; border: none;
  font-family: inherit; font-size: 0.87em; font-weight: bold;
  cursor: pointer; color: white;
}
.rb.quiero   { background: #27ae60; }
.rb.noquiero { background: #c0392b; }
.rb.raise    { background: #6c3483; }

.call-area { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.cb {
  padding: 7px 12px; border-radius: 7px; border: none;
  font-family: inherit; font-size: 0.84em; font-weight: bold;
  cursor: pointer; color: white;
}
.cb.ev { background: rgba(0,70,160,0.85); border: 1px solid #004aaa; }
.cb.tr { background: rgba(150,10,10,0.85); border: 1px solid #9a0000; font-size: 0.92em; }

.hand-area { display: flex; flex-direction: column; gap: 5px; }
.hand-label { font-size: 0.76em; opacity: 0.5; text-align: center; }
.hand-row { display: flex; gap: 8px; justify-content: center; }
.play-row { display: flex; gap: 8px; justify-content: center; align-items: center; }
.wait-msg { font-size: 0.78em; opacity: 0.5; text-align: center; padding: 4px; }

/* ── Desktop (≥768px) ─────────────────────────────────────────────────────── */
@media (min-width: 768px) {
  .gw { flex-direction: row; height: 100vh; }

  .topbar { display: none; }
  .trick-history { display: none; }

  .bc {
    flex: 1; min-height: 0;
    background: #070f09;
    overflow-y: auto;
  }

  .rp {
    width: 280px; flex-shrink: 0; overflow-y: auto;
    height: 100vh; padding: 18px 16px;
    background: rgba(0,0,0,0.4);
    border-top: none; border-left: 1px solid rgba(255,255,255,0.1);
  }

  .d-roomcode {
    display: flex; flex-direction: column; align-items: center;
    gap: 5px; padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .d-roomcode-label { font-size: 0.7em; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px; }
  .d-roomcode-pill {
    font-size: 1.5em !important; letter-spacing: 6px !important;
    padding: 5px 16px !important; background: rgba(255,255,255,0.12) !important;
    border-color: rgba(255,255,255,0.25) !important;
  }

  .d-scores { display: flex; flex-direction: column; gap: 6px; }
  .d-scores .score-pill { padding: 6px 12px; border-radius: 8px; font-size: 0.83em; font-weight: bold; }

  .d-status {
    display: block; text-align: center; font-weight: bold; font-size: 0.9em;
    padding: 8px 12px; border-radius: 8px;
  }
  .d-status.my-turn    { background: rgba(39,174,96,0.3); border: 1px solid #27ae60; }
  .d-status.their-turn { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); }

  .d-tricks {
    display: flex; flex-wrap: wrap; gap: 5px; justify-content: center;
    padding: 6px 0;
    border-top: 1px solid rgba(255,255,255,0.1);
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .d-opp { display: block; font-size: 0.78em; opacity: 0.5; text-align: center; }

  .d-leave {
    display: flex; margin-top: auto;
    border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;
  }
}

/* ── Overlays ─────────────────────────────────────────────────────────────── */
.overlay {
  position: fixed; inset: 0; background: rgba(5,10,5,0.97);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 200; gap: 20px;
  overflow-y: auto; padding: 20px;
}
.overlay h2  { font-size: 2em; color: #ff6b35; }
.overlay > p { font-size: 1em; opacity: 0.8; text-align: center; max-width: 360px; }

.big-btn {
  padding: 12px 34px; font-size: 1.05em;
  background: #c23000; color: white; border-radius: 9px;
  font-family: inherit; font-weight: bold; cursor: pointer; border: none;
}
.big-btn:hover { background: #e03800; }
.ghost-btn {
  background: transparent; color: rgba(255,255,255,0.55);
  font-size: 0.88em; padding: 7px 18px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-family: inherit;
}
.btn-dark { background: #444; color: white; border: none; border-radius: 7px; padding: 10px 16px; cursor: pointer; font-family: inherit; }
.w100 { width: 100%; }

.lobby-form { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 340px; align-items: center; }
.setup-field { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.setup-field label { font-size: 0.92em; opacity: 0.75; }
.setup-field input {
  padding: 10px 14px; border-radius: 7px; outline: none;
  border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
  color: white; font-size: 1.05em; font-family: inherit;
}
.setup-field input:focus       { border-color: rgba(255,255,255,0.55); }
.setup-field input::placeholder { opacity: 0.35; }
.lobby-btns  { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.back-link   { background: transparent; color: rgba(255,255,255,0.6); border: none; font-size: 0.9em; cursor: pointer; text-decoration: underline; padding: 4px; }

.room-code-display {
  font-size: 3em; font-weight: bold; letter-spacing: 12px;
  background: rgba(255,255,255,0.1); padding: 16px 28px;
  border-radius: 12px; border: 2px solid rgba(255,255,255,0.2);
}
.room-code-pill {
  font-family: monospace; font-size: 1.1em; letter-spacing: 3px;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px; padding: 2px 10px;
}
.error-msg {
  color: #ff6b6b; background: rgba(255,0,0,0.1);
  border: 1px solid rgba(255,0,0,0.3); border-radius: 8px;
  padding: 10px 18px; font-size: 0.92em; text-align: center; max-width: 340px;
}
.spinner {
  width: 34px; height: 34px;
  border: 3px solid rgba(255,255,255,0.2); border-top-color: white;
  border-radius: 50%; animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.reconnect-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: #7b1c00; color: white; font-size: 0.84em;
  text-align: center; padding: 8px 16px;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.reconnect-spinner {
  display: inline-block; width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
  border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
}
.reconnect-leave {
  background: rgba(255,255,255,0.2); color: white;
  border: 1px solid rgba(255,255,255,0.4); border-radius: 4px;
  padding: 2px 10px; font-size: 0.9em; cursor: pointer; font-family: inherit;
}
.opp-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  background: #7b1c00; color: white; font-size: 0.84em;
  text-align: center; padding: 8px 16px;
}

.result-body { display: flex; flex-direction: column; gap: 14px; align-items: center; max-width: 380px; width: 100%; }
.result-winner { font-size: 1.1em; text-align: center; }
.result-rows { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.result-row {
  display: flex; justify-content: space-between; gap: 10px;
  font-size: 0.83em; padding: 5px 10px;
  background: rgba(255,255,255,0.06); border-radius: 6px;
}
.score-display { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.score-pill { padding: 5px 14px; border-radius: 14px; font-weight: bold; font-size: 0.87em; }
.score-pill.p0 { background: #1155cc; }
.score-pill.p1 { background: #cc1111; }
</style>
