<template>
  <!-- ── Setup overlay ──────────────────────────────────────────────────────── -->
  <div v-if="phase === 'setup'" class="overlay">
    <h2>TRUCO</h2>
    <p class="sub">Ingresá los nombres para empezar</p>
    <div class="setup-form">
      <div class="setup-field">
        <label>Jugador 1</label>
        <input v-model="names[0]" type="text" maxlength="20" placeholder="Jugador 1" @keydown.enter="startGame" />
      </div>
      <div class="setup-field">
        <label>Jugador 2</label>
        <input v-model="names[1]" type="text" maxlength="20" placeholder="Jugador 2" @keydown.enter="startGame" />
      </div>
      <template v-if="numPlayers === 4">
        <div class="setup-field">
          <label>Jugador 3 <span class="team-tag">(equipo de J1)</span></label>
          <input v-model="names[2]" type="text" maxlength="20" placeholder="Jugador 3" @keydown.enter="startGame" />
        </div>
        <div class="setup-field">
          <label>Jugador 4 <span class="team-tag">(equipo de J2)</span></label>
          <input v-model="names[3]" type="text" maxlength="20" placeholder="Jugador 4" @keydown.enter="startGame" />
        </div>
      </template>
      <button class="big-btn" @click="startGame">Empezar ▶</button>
    </div>
    <button class="ghost-btn" @click="router.push('/truco')">← Volver</button>
  </div>

  <!-- ── Pass-device overlay ────────────────────────────────────────────────── -->
  <div v-else-if="phase === 'pass'" class="overlay">
    <h2>Turno de {{ gs.names[gs.cur] }}</h2>
    <p>Pasale el dispositivo a <strong>{{ gs.names[gs.cur] }}</strong> y tocá continuar.</p>
    <button class="big-btn" @click="phase = 'play'">Mi turno ▶</button>
  </div>

  <!-- ── Hand result overlay ────────────────────────────────────────────────── -->
  <div v-else-if="showHandResult" class="overlay">
    <h2>Mano terminada</h2>
    <div class="result-body">
      <p class="result-winner">
        <strong>{{ gs.handResult.winnerName }}</strong> ganó la mano
      </p>
      <div class="result-rows">
        <div class="result-row" v-if="gs.handResult.trucoPoints > 0">
          <span>{{ gs.handResult.trucoRejected ? 'No Quiero' : 'Truco' }}</span>
          <span>+{{ gs.handResult.trucoPoints }} pts → {{ gs.handResult.winnerName }}</span>
        </div>
        <div class="result-row" v-if="gs.handResult.trucoPoints === 0 && !gs.handResult.trucoRejected">
          <span>Mano sin truco</span>
          <span>+1 pt → {{ gs.handResult.winnerName }}</span>
        </div>
        <div class="result-row" v-if="gs.handResult.envido">
          <span>Envido</span>
          <span>+{{ gs.handResult.envido.points }} pts → {{ gs.handResult.envido.winnerName }}</span>
        </div>
        <div class="result-row" v-if="gs.handResult.envido?.scores && gs.numPlayers === 2">
          <span>Puntos envido</span>
          <span>{{ gs.names[0] }}: {{ gs.handResult.envido.scores[0] }} — {{ gs.names[1] }}: {{ gs.handResult.envido.scores[1] }}</span>
        </div>
      </div>
      <div class="score-display">
        <div class="score-pill p0">{{ teamLabel0 }}: {{ gs.scores[0] }}/30</div>
        <div class="score-pill p1">{{ teamLabel1 }}: {{ gs.scores[1] }}/30</div>
      </div>
    </div>
    <button class="big-btn" @click="nextHand">Siguiente mano ▶</button>
    <button class="ghost-btn" @click="resetToSetup">← Menú principal</button>
  </div>

  <!-- ── Game over overlay ──────────────────────────────────────────────────── -->
  <div v-else-if="phase === 'play' && gs.phase === 'game_over'" class="overlay">
    <h2>¡{{ gs.handResult?.winnerName ?? teamLabel(gs.winner) }} ganó!</h2>
    <p>Llegó a {{ gs.scores[gs.winner] }}/30 puntos — ¡Felicitaciones!</p>
    <div class="score-display">
      <div class="score-pill p0">{{ teamLabel0 }}: {{ gs.scores[0] }}</div>
      <div class="score-pill p1">{{ teamLabel1 }}: {{ gs.scores[1] }}</div>
    </div>
    <button class="big-btn" @click="resetToSetup">Nueva partida</button>
    <button class="ghost-btn" @click="router.push('/truco')">← Menú</button>
  </div>

  <!-- ── Main game UI ───────────────────────────────────────────────────────── -->
  <div v-if="phase === 'play' && gs.phase === 'playing'" class="gw">

    <!-- Top bar -->
    <div class="topbar">
      <div class="tb-score">
        <span class="pts">{{ gs.scores[0] }}</span>
        {{ teamLabel0 }}
        <span v-if="gs.mano === 0 || (gs.numPlayers === 4 && gs.mano === 2)" class="mano-tag">Mano</span>
      </div>
      <div class="tb-turn">{{ turnLabel }}</div>
      <div class="tb-score right">
        <span v-if="gs.mano === 1 || (gs.numPlayers === 4 && gs.mano === 3)" class="mano-tag">Mano</span>
        {{ teamLabel1 }}
        <span class="pts">{{ gs.scores[1] }}</span>
      </div>
    </div>

    <!-- Main area -->
    <div class="main-area">
      <!-- Trick history -->
      <div class="trick-history">
        <div v-for="(result, i) in gs.tricks" :key="i" class="trick-badge"
             :class="result === 'tie' ? 'tie' : result === 0 ? 'p0' : 'p1'">
          Truco {{ i+1 }}: {{ result === 'tie' ? 'Parda' : (i === 0 ? gs.handResult?.winnerName ?? '' : trickTeamName(result)) }}
        </div>
        <div v-for="i in (3 - gs.tricks.length)" :key="'e'+i" class="trick-badge empty">
          Truco {{ gs.tricks.length + i }}
        </div>
      </div>

      <!-- Bet status -->
      <div v-if="gs.envido.pending" class="bet-banner envido-banner">
        <strong>{{ gs.names[gs.envido.calledBy] }}</strong> canta
        <strong>{{ ENVIDO_LEVEL_NAMES[gs.envido.level] }}</strong>
        — vale {{ gs.envido.value }} pts
        (no quiero: {{ gs.envido.noQValue }} pt)
      </div>
      <div v-else-if="gs.truco.pending" class="bet-banner truco-banner">
        <strong>{{ gs.names[gs.truco.calledBy] }}</strong> canta
        <strong>{{ TRUCO_LEVEL_NAMES[gs.truco.level] }}</strong>
        — vale {{ gs.truco.value }} pts
        (no quiero: {{ gs.truco.noQValue }} pt)
      </div>
      <div v-else-if="gs.envido.done && gs.envido.winner !== null" class="bet-banner result-banner">
        Envido: <strong>{{ gs.names[gs.envido.winner] ?? teamLabel(gs.envido.winner) }}</strong> ganó {{ gs.envido.points }} pts
        <template v-if="gs.envido.scores && gs.numPlayers === 2"> ({{ gs.envido.scores[0] }} vs {{ gs.envido.scores[1] }})</template>
      </div>

      <!-- Table: cards played this trick -->
      <div class="table">
        <div class="table-row" v-for="pi in playerIndices" :key="pi"
             :class="gs.numPlayers === 4 ? (pi % 2 === 0 ? 'team0-row' : 'team1-row') : ''">
          <div class="table-name" :class="{ 'active-p': gs.cur === pi }">
            {{ gs.names[pi] }}
            <span v-if="gs.mano === pi" class="mano-dot">●</span>
          </div>
          <TrucoCard v-if="gs.trickCards[pi]" :card="gs.trickCards[pi]" />
          <div v-else class="card-slot">
            {{ gs.cur === pi && !hasBetPending ? '▶' : '·' }}
          </div>
        </div>
      </div>

      <!-- Last trick -->
      <div v-if="gs.lastTrickCards && gs.tricks.length > 0" class="last-trick">
        <span class="lt-label">Último:</span>
        <template v-for="(card, i) in gs.lastTrickCards.filter(c => c)" :key="i">
          <TrucoCard :card="card" :small="true" />
          <span v-if="i < gs.lastTrickCards.filter(c=>c).length - 1" class="vs">vs</span>
        </template>
        <span class="lt-res" :class="lastTrickResult === 'tie' ? 'tie' : 'win'">
          {{ lastTrickResult === 'tie' ? 'Parda' : '→ ' + trickTeamName(lastTrickResult) }}
        </span>
      </div>
    </div>

    <!-- Bottom panel -->
    <div class="bottom-panel">

      <!-- Bet response -->
      <div v-if="hasBetPending" class="resp-area">
        <div class="resp-label">
          {{ gs.names[gs.cur] }} responde a {{ betCallerName }}:
        </div>
        <div class="resp-btns">
          <button class="rb quiero" @click="doAction('quiero')">Quiero</button>
          <button class="rb noquiero" @click="doAction('no_quiero')">No Quiero</button>
          <template v-if="gs.envido.pending">
            <button v-if="gs.envido.level < 2" class="rb raise" @click="doAction('call_envido')">Envido</button>
            <button v-if="gs.envido.level < 3" class="rb raise" @click="doAction('call_real_envido')">Real Envido</button>
            <button v-if="gs.envido.level < 4" class="rb raise" @click="doAction('call_falta_envido')">Falta Envido</button>
          </template>
          <template v-if="gs.truco.pending">
            <button v-if="gs.truco.level === 1" class="rb raise" @click="doAction('call_retruco')">Retruco</button>
            <button v-if="gs.truco.level === 2" class="rb raise" @click="doAction('call_vale4')">Vale Cuatro</button>
          </template>
        </div>
      </div>

      <!-- Call bets (play turn) -->
      <div v-else class="call-area">
        <template v-if="gs.currentTrick === 0 && !gs.envido.done">
          <button v-if="gs.envido.level < 2" class="cb ev" @click="doAction('call_envido')">Envido</button>
          <button v-if="gs.envido.level < 3" class="cb ev" @click="doAction('call_real_envido')">Real Envido</button>
          <button v-if="gs.envido.level < 4" class="cb ev" @click="doAction('call_falta_envido')">Falta Envido</button>
        </template>
        <button v-if="!gs.truco.done && !gs.truco.pending" class="cb tr" @click="doAction('call_truco')">¡Truco!</button>
      </div>

      <!-- Hand -->
      <div class="hand-area">
        <div class="hand-label">— Mano de {{ gs.names[gs.cur] }} —</div>
        <div class="hand-row">
          <TrucoCard
            v-for="(card, idx) in gs.hands[gs.cur]"
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
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TrucoCard from '../components/TrucoCard.vue'
import { buildInitialState, applyAction, ENVIDO_LEVEL_NAMES, TRUCO_LEVEL_NAMES } from '../game/trucoLogic.js'

const router   = useRouter()
const route    = useRoute()
const SAVE_KEY = 'truco_save_local'

// Determine player count from query param or saved game
let saved = null
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch (_) {}

const numPlayers = saved?.numPlayers ?? (parseInt(route.query.players) === 4 ? 4 : 2)
const names      = ref(Array.from({ length: numPlayers }, (_, i) => ''))

const phase        = ref('setup')
const selectedCard = ref(null)

const gs = reactive(saved ?? buildInitialState(Array.from({ length: numPlayers }, (_, i) => `Jugador ${i+1}`)))
if (saved) {
  if (saved.phase === 'game_over') phase.value = 'play'
  else if (saved.phase === 'hand_result') phase.value = 'play'
  else phase.value = 'pass'
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(gs)) } catch (_) {}
}

function startGame() {
  const resolvedNames = names.value.map((n, i) => n.trim() || `Jugador ${i+1}`)
  Object.assign(gs, buildInitialState(resolvedNames))
  selectedCard.value = null
  save()
  phase.value = 'pass'
}

function resetToSetup() {
  localStorage.removeItem(SAVE_KEY)
  names.value = names.value.map(() => '')
  phase.value = 'setup'
}

function nextHand() {
  applyAction(gs, 0, { type: 'next_hand' })
  selectedCard.value = null
  save()
  if (gs.phase === 'game_over') return
  phase.value = 'pass'
}

// ── Computed ──────────────────────────────────────────────────────────────────

const playerIndices = computed(() => Array.from({ length: gs.names.length }, (_, i) => i))

const teamLabel0 = computed(() => gs.numPlayers === 4 ? `${gs.names[0]} & ${gs.names[2]}` : gs.names[0])
const teamLabel1 = computed(() => gs.numPlayers === 4 ? `${gs.names[1]} & ${gs.names[3]}` : gs.names[1])
const teamLabel  = (team) => team === 0 ? teamLabel0.value : teamLabel1.value
const trickTeamName = (team) => team === 0 ? teamLabel0.value : teamLabel1.value

const showHandResult = computed(() =>
  phase.value === 'play' && gs.phase === 'hand_result'
)

const hasBetPending = computed(() => gs.envido.pending || gs.truco.pending)

const canPlayCard = computed(() =>
  !hasBetPending.value && gs.phase === 'playing' && gs.cur === gs.trickCur
)

const turnLabel = computed(() => {
  if (gs.envido.pending) return `${gs.names[gs.cur]}: responder Envido`
  if (gs.truco.pending)  return `${gs.names[gs.cur]}: responder Truco`
  return gs.names[gs.cur]
})

const betCallerName = computed(() => {
  if (gs.envido.pending) return gs.names[gs.envido.calledBy]
  if (gs.truco.pending)  return gs.names[gs.truco.calledBy]
  return ''
})

const lastTrickResult = computed(() => {
  if (!gs.tricks.length) return null
  return gs.tricks[gs.tricks.length - 1]
})

// ── Actions ───────────────────────────────────────────────────────────────────
function onCardClick(idx) {
  if (!canPlayCard.value) return
  if (gs.hands[gs.cur][idx] === null) return
  selectedCard.value = selectedCard.value === idx ? null : idx
}

function playSelected() {
  if (selectedCard.value === null) return
  const idx = selectedCard.value
  selectedCard.value = null
  const prevPlayer = gs.cur
  const result = applyAction(gs, prevPlayer, { type: 'play_card', cardIndex: idx })
  if (!result.ok) { console.warn(result.error); return }
  save()
  if (gs.phase === 'playing' && !gs.envido.pending && !gs.truco.pending && gs.cur !== prevPlayer) {
    phase.value = 'pass'
  }
}

function doAction(type, extra = {}) {
  const prevPlayer = gs.cur
  const result = applyAction(gs, prevPlayer, { type, ...extra })
  if (!result.ok) { console.warn(result.error); return }
  save()
  if (gs.phase === 'playing' && !gs.envido.pending && !gs.truco.pending && gs.cur !== prevPlayer) {
    phase.value = 'pass'
  }
}
</script>

<style scoped>
.gw {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: #0a1a0e;
}

/* ── Topbar ───────────────────────────────────────────────────────────────── */
.topbar {
  flex-shrink: 0;
  height: 46px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  gap: 8px;
  background: rgba(0,0,0,0.5);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.tb-score {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78em;
  font-weight: bold;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tb-score.right { justify-content: flex-end; }
.pts { font-size: 1.15em; color: #ffc850; }
.mano-tag {
  font-size: 0.68em; font-weight: bold;
  background: #f5c518; color: #000;
  padding: 1px 5px; border-radius: 4px;
}
.mano-dot { color: #f5c518; font-size: 0.7em; }
.tb-turn {
  flex: 0 0 auto;
  text-align: center;
  font-size: 0.76em;
  font-weight: bold;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.12);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Main area ────────────────────────────────────────────────────────────── */
.main-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trick-history {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.trick-badge {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.73em;
  font-weight: bold;
}
.trick-badge.p0    { background: rgba(30,80,200,0.55); }
.trick-badge.p1    { background: rgba(180,20,20,0.55); }
.trick-badge.tie   { background: rgba(160,130,0,0.55); }
.trick-badge.empty { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); }

.bet-banner {
  text-align: center;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 0.83em;
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
  gap: 8px;
}
.table-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.team0-row { border-left: 2px solid rgba(30,80,200,0.4); padding-left: 6px; border-radius: 2px; }
.team1-row { border-left: 2px solid rgba(180,20,20,0.4); padding-left: 6px; border-radius: 2px; }
.table-name {
  width: 90px;
  font-size: 0.82em;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(255,255,255,0.7);
}
.table-name.active-p { color: #7fff9d; }
.card-slot {
  width: 54px;
  height: 78px;
  border: 2px dashed rgba(255,255,255,0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3em;
  color: rgba(255,255,255,0.15);
}

.last-trick {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.76em;
  opacity: 0.6;
  flex-wrap: wrap;
}
.lt-label { color: rgba(255,255,255,0.4); }
.vs { opacity: 0.4; }
.lt-res.win { color: #7fff9d; }
.lt-res.tie { color: #f5c518; }

/* ── Bottom panel ─────────────────────────────────────────────────────────── */
.bottom-panel {
  flex-shrink: 0;
  background: rgba(0,0,0,0.35);
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resp-area { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.resp-label { font-size: 0.78em; opacity: 0.65; }
.resp-btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.rb {
  padding: 8px 16px; border-radius: 7px; border: none;
  font-family: inherit; font-size: 0.88em; font-weight: bold;
  cursor: pointer; color: white;
}
.rb.quiero   { background: #27ae60; }
.rb.noquiero { background: #c0392b; }
.rb.raise    { background: #6c3483; }

.call-area { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.cb {
  padding: 7px 14px; border-radius: 7px; border: none;
  font-family: inherit; font-size: 0.85em; font-weight: bold;
  cursor: pointer; color: white;
}
.cb.ev { background: rgba(0,70,160,0.85); border: 1px solid #004aaa; }
.cb.tr { background: rgba(150,10,10,0.85); border: 1px solid #9a0000; font-size: 0.95em; }

.hand-area { display: flex; flex-direction: column; gap: 6px; }
.hand-label { font-size: 0.78em; opacity: 0.55; text-align: center; }
.hand-row { display: flex; gap: 10px; justify-content: center; }
.play-row { display: flex; gap: 8px; justify-content: center; align-items: center; }

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
.sub { margin-top: -12px; font-size: 0.9em; opacity: 0.7; }

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

.setup-form  { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 320px; }
.setup-field { display: flex; flex-direction: column; gap: 5px; }
.setup-field label { font-size: 0.9em; opacity: 0.7; }
.setup-field input {
  padding: 10px 12px; border-radius: 7px; outline: none;
  border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
  color: white; font-size: 1em; font-family: inherit;
}
.setup-field input:focus       { border-color: rgba(255,255,255,0.55); }
.setup-field input::placeholder { opacity: 0.35; }
.team-tag { font-size: 0.8em; opacity: 0.6; font-weight: normal; }

.result-body { display: flex; flex-direction: column; gap: 14px; align-items: center; max-width: 380px; width: 100%; }
.result-winner { font-size: 1.1em; text-align: center; }
.result-rows { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.result-row {
  display: flex; justify-content: space-between; gap: 10px;
  font-size: 0.84em; padding: 5px 10px;
  background: rgba(255,255,255,0.06); border-radius: 6px;
}
.score-display { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.score-pill { padding: 5px 16px; border-radius: 16px; font-weight: bold; font-size: 0.9em; }
.score-pill.p0 { background: #1155cc; }
.score-pill.p1 { background: #cc1111; }
</style>
