<template>
  <!-- Setup overlay -->
  <div v-if="phase === 'setup'" class="overlay">
    <h2>SEQUENCE</h2>
    <p class="sub">Enter player names to begin</p>
    <div class="setup-form">
      <div class="setup-field">
        <label><span class="dot s0"></span>Player 1 (blue chips)</label>
        <input v-model="name0" type="text" maxlength="20" placeholder="Player 1" @keydown.enter="startGame" />
      </div>
      <div class="setup-field">
        <label><span class="dot s1"></span>Player 2 (red chips)</label>
        <input v-model="name1" type="text" maxlength="20" placeholder="Player 2" @keydown.enter="startGame" />
      </div>
      <button class="big-btn" @click="startGame">Start Game ▶</button>
    </div>
    <button class="ghost-btn" @click="router.push('/sequence')">← Back</button>
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
    <button class="ghost-btn" @click="router.push('/sequence')">← Main Menu</button>
  </div>

  <!-- Confirm new game -->
  <div v-if="showConfirm" class="overlay semi">
    <div class="confirm-box">
      <h3>Start a new game?</h3>
      <p>The current game will be lost.</p>
      <div class="confirm-btns">
        <button class="btn-gray"   @click="showConfirm = false">Cancel</button>
        <button class="btn-danger" @click="confirmNewGame">New Game</button>
      </div>
    </div>
  </div>

  <!-- Mobile menu drawer -->
  <div v-if="menuOpen" class="menu-veil" @click.self="menuOpen = false">
    <div class="menu-drawer">
      <button class="drawer-close" @click="menuOpen = false">✕</button>
      <div class="legend-text">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>
      <p class="deck-note">Deck: {{ state.deck.length }} cards remaining</p>
      <button class="big-btn sm" @click="requestNewGame(); menuOpen = false">New Game</button>
      <button class="ghost-btn sm" @click="router.push('/sequence')">← Main Menu</button>
    </div>
  </div>

  <!-- Game UI -->
  <div v-if="phase === 'play'" class="gw">

    <!-- ① Mobile top bar (hidden on desktop) -->
    <div class="topbar">
      <span class="sc s0">{{ state.names[0] }} {{ state.seqs[0] }}/2</span>
      <span class="tc" :class="state.cur === 0 ? 's0' : 's1'">▶ {{ state.names[state.cur] }}</span>
      <span class="sc s1">{{ state.names[1] }} {{ state.seqs[1] }}/2</span>
      <button class="menu-btn" @click="menuOpen = true">☰</button>
    </div>

    <!-- ② Board -->
    <div class="bc">
      <GameBoard
        :board="state.board"
        :locked="state.locked"
        :removeSet="removeTargetSet"
        :lastChipKey="lastChipKey"
        @cell-click="onCellClick"
      />
    </div>

    <!-- ③ Right panel — bottom bar on mobile, sidebar on desktop -->
    <div class="rp">

      <!-- Desktop only: scores + deck -->
      <div class="d-scores">
        <div class="seq-badge s0">{{ state.names[0] }} — {{ state.seqs[0] }} / 2</div>
        <div class="seq-badge s1">{{ state.names[1] }} — {{ state.seqs[1] }} / 2</div>
      </div>
      <div class="d-deck">Cards in deck: <strong>{{ state.deck.length }}</strong></div>

      <!-- Shared: message -->
      <div class="msg-box">{{ message }}</div>

      <!-- Desktop only: hand label -->
      <div class="d-label">— {{ state.names[state.cur] }}'s hand —</div>

      <!-- Shared: hand (order 3 on mobile, natural on desktop) -->
      <div class="hc">
        <PlayerHand
          :cards="state.hands[state.cur]"
          :selCard="state.selCard"
          :actionTaken="state.actionTaken"
          :gameState="state"
          @select="onSelectCard"
        />
      </div>

      <!-- Shared: action buttons (order 2 on mobile) -->
      <div class="btn-row">
        <button v-if="state.selCard !== null && !state.actionTaken" class="btn-gray"   @click="onCancel">Cancel</button>
        <button v-if="showDiscard"                                  class="btn-orange" @click="onDiscard">Discard</button>
        <button v-if="state.actionTaken"                            class="btn-purple" @click="onUndo">Undo</button>
        <button                                                     class="btn-red"    @click="onEndTurn" :disabled="!state.actionTaken">Confirm</button>
      </div>

      <!-- Desktop only: legend + new game -->
      <div class="d-legend">
        <strong>Jacks:</strong><br>
        J♥ J♠ = one-eyed → remove opponent chip<br>
        J♦ J♣ = two-eyed → place chip anywhere<br>
        <strong>Win:</strong> first to 2 sequences (5 in a row).<br>
        FREE corners count as wild for both players.
      </div>
      <div class="d-newgame">
        <button class="btn-green w100" @click="requestNewGame">New Game</button>
        <button class="btn-dark  w100" @click="router.push('/sequence')">← Main Menu</button>
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

const router  = useRouter()
const SAVE_KEY = 'sequence_save_local'

const phase       = ref('setup')
const name0       = ref('')
const name1       = ref('')
const message     = ref('')
const showConfirm = ref(false)
const menuOpen    = ref(false)

let saved = null
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)) } catch (_) {}
const state = reactive(saved && !saved.over ? saved : buildInitialState('Player 1', 'Player 2'))
if (saved) phase.value = saved.over ? 'over' : 'turn'

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch (_) {}
}

function setMsg() {
  message.value = state.actionTaken
    ? 'Action done — press Confirm to end your turn.'
    : `${state.names[state.cur]}'s turn — select a card.`
}

function startGame() {
  Object.assign(state, buildInitialState(name0.value.trim() || 'Player 1', name1.value.trim() || 'Player 2'))
  save(); phase.value = 'turn'
}

function resetToSetup() {
  localStorage.removeItem(SAVE_KEY)
  name0.value = ''; name1.value = ''; phase.value = 'setup'
}

function requestNewGame() {
  if (!state.over) { showConfirm.value = true } else { resetToSetup() }
}

function confirmNewGame() {
  showConfirm.value = false
  localStorage.removeItem(SAVE_KEY)
  name0.value = state.names[0]; name1.value = state.names[1]; phase.value = 'setup'
}

const removeTargetSet = computed(() => {
  if (state.selCard === null || state.mode !== 'remove') return new Set()
  return new Set(validPositions(state, state.hands[state.cur][state.selCard]).map(([r,c]) => `${r},${c}`))
})

const lastChipKey = computed(() => {
  const lc = state.lastChip
  return lc ? `${lc.r},${lc.c}` : null
})

const showDiscard = computed(() =>
  state.selCard !== null && !state.actionTaken && isDead(state, state.hands[state.cur][state.selCard])
)

function onSelectCard(idx) {
  localSelectCard(state, idx)
  const card = state.hands[state.cur][idx]
  message.value = isOneEye(card) ? 'One-eyed Jack — click an opponent chip to remove it.' : `${card} selected — click a highlighted space.`
  save()
}
function onCellClick(r, c) {
  localCellClick(state, r, c); save()
  if (state.over) { phase.value = 'over' } else { setMsg() }
}
function onDiscard()  { localDiscardDead(state); save(); message.value = 'Dead card discarded. Press Confirm.' }
function onCancel()   { localCancelSel(state); setMsg(); save() }
function onUndo()     { localUndo(state); save(); setMsg() }
function onEndTurn()  { localEndTurn(state); save(); phase.value = 'turn' }
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
  opacity: 0.9;
}
.tc.s0 { background: rgba(17,85,204,0.5); }
.tc.s1 { background: rgba(204,17,17,0.5); }
.menu-btn {
  background: rgba(255,255,255,0.1);
  color: white;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 1em;
  cursor: pointer;
  flex-shrink: 0;
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
/* Square board sized to fit between topbar and bottom panel */
.bc :deep(#board-wrapper) {
  width:  min(100vw, calc(100dvh - 212px));
  height: min(100vw, calc(100dvh - 212px));
  border: none;
  padding: 3px;
}

/* ─── Right panel (bottom bar on mobile) ─────────────────────────────────── */
.rp {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #1a3d28;
  border-top: 2px solid rgba(255,255,255,0.1);
}

/* Desktop-only elements: hidden on mobile */
.d-scores, .d-deck, .d-label, .d-legend, .d-newgame { display: none; }

/* Message */
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

/* Buttons row */
.btn-row {
  order: 2;
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 5px 8px;
}
.btn-row button { padding: 8px 14px; font-size: 0.88em; border-radius: 6px; color: white; }

/* Hand */
.hc {
  order: 3;
  padding: 5px 6px 8px;
}

/* ─── Button colors ───────────────────────────────────────────────────────── */
.btn-gray   { background: #7f8c8d !important; }
.btn-orange { background: #e67e22 !important; }
.btn-purple { background: #8e44ad !important; }
.btn-red    { background: #e74c3c !important; }
.btn-green  { background: #27ae60 !important; color: white; }
.btn-dark   { background: #555    !important; color: white; }
.w100       { width: 100%; }

/* ─── Desktop override (≥768px) ──────────────────────────────────────────── */
@media (min-width: 768px) {
  .gw { flex-direction: row; height: 100vh; }

  .topbar { display: none; }

  .bc {
    flex-shrink: 0;
    background: transparent;
    align-items: stretch;
    justify-content: stretch;
  }
  .bc :deep(#board-wrapper) {
    height: 100vh;
    width: auto;
    aspect-ratio: 1/1;
    border-right: 3px solid #333;
    padding: 4px;
    background: #111;
  }

  .rp {
    flex: 1;
    overflow-y: auto;
    height: 100vh;
    padding: 18px 20px;
    gap: 14px;
    background: transparent;
    border-top: none;
  }

  /* Show desktop-only items */
  .d-scores {
    display: flex; gap: 10px; justify-content: center;
  }
  .d-deck  { display: block; text-align: center; font-size: 0.9em; opacity: 0.75; }
  .d-label { display: block; text-align: center; font-size: 1em; opacity: 0.8; }
  .d-legend {
    display: block;
    font-size: 0.78em; opacity: 0.65; line-height: 1.7;
    border-top: 1px solid rgba(255,255,255,0.15); padding-top: 8px;
  }
  .d-newgame {
    display: flex; flex-direction: column; gap: 8px;
    border-top: 1px solid rgba(255,255,255,0.15); padding-top: 12px;
  }

  /* Desktop badges */
  .seq-badge { padding: 5px 18px; border-radius: 20px; font-weight: bold; font-size: 0.95em; }
  .seq-badge.s0 { background: #1155cc; }
  .seq-badge.s1 { background: #cc1111; }

  /* Reset mobile ordering */
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
  z-index: 200; gap: 20px;
  overflow-y: auto; padding: 20px;
}
.overlay.semi { background: rgba(0,0,0,0.8); }
.overlay h2  { font-size: 2.2em; }
.overlay > p { font-size: 1.05em; opacity: 0.8; text-align: center; max-width: 340px; }
.sub { margin-top: -10px; font-size: 0.95em; opacity: 0.8; }

.big-btn {
  padding: 14px 40px; font-size: 1.15em;
  background: #27ae60; color: white; border-radius: 9px;
  font-family: inherit; font-weight: bold; cursor: pointer; border: none;
}
.big-btn.sm { padding: 12px 32px; font-size: 1em; }
.big-btn:hover { background: #229954; }
.ghost-btn {
  background: transparent; color: rgba(255,255,255,0.6);
  font-size: 0.95em; padding: 8px 20px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2); cursor: pointer; font-family: inherit;
}
.ghost-btn.sm { font-size: 0.9em; }

.setup-form  { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 340px; }
.setup-field { display: flex; flex-direction: column; gap: 6px; }
.setup-field label { font-size: 0.95em; opacity: 0.8; }
.setup-field input {
  padding: 10px 14px; border-radius: 7px; outline: none;
  border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1);
  color: white; font-size: 1.05em; font-family: inherit;
  transition: border-color 0.15s;
}
.setup-field input:focus    { border-color: rgba(255,255,255,0.6); }
.setup-field input::placeholder { opacity: 0.4; }
.dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
.dot.s0 { background: radial-gradient(circle at 35% 35%, #7eb3ff, #1144bb); }
.dot.s1 { background: radial-gradient(circle at 35% 35%, #ff9999, #bb1111); }

.confirm-box { background: #1e3a2a; border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 28px 32px; display: flex; flex-direction: column; align-items: center; gap: 18px; max-width: 360px; width: 90%; }
.confirm-box h3 { font-size: 1.3em; }
.confirm-box p  { font-size: 0.9em; opacity: 0.7; text-align: center; }
.confirm-btns   { display: flex; gap: 12px; }
.confirm-btns button { padding: 10px 24px; border-radius: 7px; color: white; cursor: pointer; border: none; font-weight: bold; font-family: inherit; }
.btn-danger { background: #e74c3c; }

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
