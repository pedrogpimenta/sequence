// trucoLogic.js — Argentinian Truco (2 or 4 players, 30 points)

const SUITS  = ['E', 'B', 'O', 'C']
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

function suit(c)  { return c[c.length - 1] }
function num(c)   { return parseInt(c) }

function trucoRank(c) {
  const v = num(c), s = suit(c)
  if (v === 1  && s === 'E') return 14
  if (v === 1  && s === 'B') return 13
  if (v === 7  && s === 'E') return 12
  if (v === 7  && s === 'O') return 11
  if (v === 3)               return 10
  if (v === 2)               return 9
  if (v === 1)               return 8
  if (v === 12)              return 7
  if (v === 11)              return 6
  if (v === 10)              return 5
  if (v === 7)               return 4
  if (v === 6)               return 3
  if (v === 5)               return 2
  return 1
}

function envidoVal(c) { const v = num(c); return v >= 10 ? 0 : v }

function calcEnvido(hand) {
  const bySuit = {}
  for (const c of hand) {
    const s = suit(c)
    if (!bySuit[s]) bySuit[s] = []
    bySuit[s].push(envidoVal(c))
  }
  let best = 0
  for (const vals of Object.values(bySuit)) {
    if (vals.length >= 2) {
      vals.sort((a, b) => b - a)
      best = Math.max(best, 20 + vals[0] + vals[1])
    } else {
      best = Math.max(best, vals[0])
    }
  }
  return best
}

function buildDeck() {
  const d = []
  for (const s of SUITS) for (const v of VALUES) d.push(`${v}${s}`)
  return shuffle(d)
}

function shuffle(a) {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function faltaVal(scores) { return Math.max(1, 30 - Math.min(scores[0], scores[1])) }

// team: 0 = players 0 & 2, team 1 = players 1 & 3
function teamOf(playerIndex) { return playerIndex % 2 }

function teamName(state, team) {
  if (state.numPlayers === 2) return state.names[team]
  return `${state.names[team]} & ${state.names[team + 2]}`
}

// Best envido score for a team (4P: max of both members; 2P: just that player)
function envidoTeamScore(state, team) {
  const s0 = calcEnvido(state.initialHands[team])
  if (state.numPlayers === 2) return s0
  return Math.max(s0, calcEnvido(state.initialHands[team + 2]))
}

function initEnvido() {
  return { pending: false, calledBy: null, level: 0, value: 0, noQValue: 0, done: false, winner: null, points: 0, showScores: false, scores: null }
}

function initTruco() {
  return { pending: false, calledBy: null, level: 0, value: 1, noQValue: 0, done: false, rejected: false }
}

function dealHand(state) {
  const n    = state.numPlayers
  const deck = buildDeck()
  const mano = state.mano === null ? 0 : (state.mano + 1) % n
  state.mano          = mano
  state.initialHands  = Array.from({ length: n }, (_, i) => deck.slice(i * 3, i * 3 + 3))
  state.hands         = state.initialHands.map(h => [...h])
  state.trickCards    = new Array(n).fill(null)
  state.lastTrickCards = null
  state.trickCur      = mano
  state.trickLeader   = mano
  state.currentTrick  = 0
  state.tricks        = []
  state.envido        = initEnvido()
  state.truco         = initTruco()
  state.cur           = mano
  state.phase         = 'playing'
  state.handResult    = null
  state.handNumber    = (state.handNumber || 0) + 1
}

// ── Public API ────────────────────────────────────────────────────────────────

// names: array of 2 or 4 player names
export function buildInitialState(names) {
  const numPlayers = names.length
  const state = {
    gameType: 'truco', numPlayers,
    names: [...names],
    scores: [0, 0],
    over: false, winner: null,
    mano: null, handNumber: 0,
    hands: null, initialHands: null,
    trickCards: null, lastTrickCards: null,
    trickCur: 0, trickLeader: 0,
    currentTrick: 0, tricks: [],
    envido: initEnvido(),
    truco:  initTruco(),
    cur: 0, phase: 'playing',
    handResult: null,
  }
  dealHand(state)
  return state
}

export function getPlayerView(state, playerIndex) {
  const handCounts = state.hands.map(h => h.filter(c => c !== null).length)
  return {
    gameType:       'truco',
    numPlayers:     state.numPlayers,
    names:          state.names,
    scores:         state.scores,
    myHand:         state.hands[playerIndex],
    handCounts,
    oppHandCount:   handCounts[1 - playerIndex],  // 2P compat
    mano:           state.mano,
    currentTrick:   state.currentTrick,
    trickCards:     state.trickCards,
    lastTrickCards: state.lastTrickCards,
    trickLeader:    state.trickLeader,
    trickCur:       state.trickCur,
    tricks:         state.tricks,
    envido:         state.envido,
    truco:          state.truco,
    cur:            state.cur,
    phase:          state.phase,
    handResult:     state.handResult,
    over:           state.over,
    winner:         state.winner,
    myIndex:        playerIndex,
    handNumber:     state.handNumber,
  }
}

export function handleAction(state, playerIndex, msg) {
  if (state.over && msg.type !== 'next_hand') return { ok: false, error: 'Game is over' }
  if (msg.type === 'next_hand') return actNextHand(state)
  if (state.cur !== playerIndex) return { ok: false, error: 'Not your turn' }

  switch (msg.type) {
    case 'play_card':         return actPlayCard(state, playerIndex, msg.cardIndex)
    case 'call_envido':       return actEnvido(state, playerIndex, 'envido')
    case 'call_real_envido':  return actEnvido(state, playerIndex, 'real_envido')
    case 'call_falta_envido': return actEnvido(state, playerIndex, 'falta_envido')
    case 'call_truco':        return actTruco(state, playerIndex, 1)
    case 'call_retruco':      return actTruco(state, playerIndex, 2)
    case 'call_vale4':        return actTruco(state, playerIndex, 3)
    case 'quiero':            return actQuiero(state, playerIndex)
    case 'no_quiero':         return actNoQuiero(state, playerIndex)
    default:                  return { ok: false, error: 'Unknown action' }
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

function actPlayCard(state, playerIndex, cardIndex) {
  if (state.envido.pending || state.truco.pending)
    return { ok: false, error: 'Hay una apuesta pendiente' }
  if (state.phase !== 'playing')
    return { ok: false, error: 'No es el momento de jugar' }
  if (state.cur !== state.trickCur)
    return { ok: false, error: 'No es tu turno de jugar una carta' }
  if (state.trickCards[playerIndex] !== null)
    return { ok: false, error: 'Ya jugaste en este truco' }

  const hand = state.hands[playerIndex]
  if (cardIndex < 0 || cardIndex >= hand.length || hand[cardIndex] === null)
    return { ok: false, error: 'Carta inválida' }

  const card = hand[cardIndex]
  hand[cardIndex] = null
  state.trickCards[playerIndex] = card

  if (state.trickCards.every(c => c !== null)) {
    resolveTrick(state)
  } else {
    const next = (playerIndex + 1) % state.numPlayers
    state.trickCur = next
    state.cur      = next
  }
  return { ok: true }
}

function bestByTurnOrder(candidates, trickLeader, n) {
  let best = candidates[0], bestPos = (best - trickLeader + n) % n
  for (const p of candidates.slice(1)) {
    const pos = (p - trickLeader + n) % n
    if (pos < bestPos) { best = p; bestPos = pos }
  }
  return best
}

function resolveTrick(state) {
  const n = state.numPlayers
  const ranks = state.trickCards.map(trucoRank)
  let result, nextLeaderPlayer

  if (n === 2) {
    const r0 = ranks[0], r1 = ranks[1]
    result = r0 > r1 ? 0 : r1 > r0 ? 1 : 'tie'
    nextLeaderPlayer = result === 'tie' ? state.mano : result
  } else {
    const t0best = Math.max(ranks[0], ranks[2])
    const t1best = Math.max(ranks[1], ranks[3])
    if (t0best > t1best) {
      result = 0
      const cands = [0, 2].filter(i => ranks[i] === t0best)
      nextLeaderPlayer = bestByTurnOrder(cands, state.trickLeader, n)
    } else if (t1best > t0best) {
      result = 1
      const cands = [1, 3].filter(i => ranks[i] === t1best)
      nextLeaderPlayer = bestByTurnOrder(cands, state.trickLeader, n)
    } else {
      result = 'tie'
      nextLeaderPlayer = state.mano
    }
  }

  state.tricks.push(result)
  state.lastTrickCards = [...state.trickCards]
  state.trickCards = new Array(n).fill(null)

  if (state.currentTrick === 0 && !state.envido.done)
    state.envido.done = true

  const hw = handWinner(state)
  if (hw !== null) { endHand(state, hw); return }

  state.currentTrick++
  state.trickLeader = nextLeaderPlayer
  state.trickCur    = nextLeaderPlayer
  state.cur         = nextLeaderPlayer
}

function handWinner(state) {
  const T  = state.tricks
  const w0 = T.filter(t => t === 0).length
  const w1 = T.filter(t => t === 1).length
  if (w0 >= 2) return 0
  if (w1 >= 2) return 1
  if (T.length === 2) {
    if (T[0] === 'tie' && T[1] !== 'tie') return T[1]
    if (T[0] !== 'tie' && T[1] === 'tie') return T[0]
    return null
  }
  if (T.length === 3) {
    if (w0 > w1) return 0
    if (w1 > w0) return 1
    const first = T.find(t => t !== 'tie')
    return first !== undefined ? first : teamOf(state.mano)
  }
  return null
}

function endHand(state, winnerTeam) {
  if (!state.envido.done) state.envido.done = true
  const trucoVal = state.truco.level === 0 ? 1 : state.truco.value
  if (!state.truco.rejected) givePoints(state, winnerTeam, trucoVal)

  state.handResult = {
    winner:        winnerTeam,
    winnerName:    teamName(state, winnerTeam),
    tricks:        [...state.tricks],
    lastTrickCards:state.lastTrickCards,
    trucoPoints:   state.truco.rejected ? 0 : trucoVal,
    trucoLevel:    state.truco.level,
    trucoRejected: state.truco.rejected,
    envido:        envidoResultForHand(state),
    scores:        [...state.scores],
  }
  state.phase = state.over ? 'game_over' : 'hand_result'
}

function envidoResultForHand(state) {
  const ev = state.envido
  if (!ev.done || ev.winner === null) return null
  return { winner: ev.winner, winnerName: teamName(state, ev.winner), points: ev.points, scores: ev.scores }
}

function givePoints(state, team, points) {
  state.scores[team] += points
  if (state.scores[team] >= 30) { state.over = true; state.winner = team }
}

// ── Envido ────────────────────────────────────────────────────────────────────

function actEnvido(state, playerIndex, callType) {
  if (state.truco.pending)
    return { ok: false, error: 'Responde el Truco primero' }
  if (state.envido.done)
    return { ok: false, error: 'El Envido ya terminó' }
  if (state.currentTrick > 0)
    return { ok: false, error: 'El Envido sólo se canta en el primer truco' }
  if (state.envido.pending && teamOf(playerIndex) === teamOf(state.envido.calledBy))
    return { ok: false, error: 'Esperando respuesta del oponente' }

  const ev = state.envido, lvl = ev.level, curVal = ev.value
  let newLevel, newValue, newNoQ

  if (callType === 'envido') {
    if      (lvl === 0) { newLevel = 1; newValue = 2; newNoQ = 1 }
    else if (lvl === 1) { newLevel = 2; newValue = 4; newNoQ = 2 }
    else return { ok: false, error: 'No se puede cantar Envido ahora' }
  } else if (callType === 'real_envido') {
    if      (lvl === 0) { newLevel = 3; newValue = 3;      newNoQ = 1 }
    else if (lvl === 1) { newLevel = 3; newValue = 5;      newNoQ = 2 }
    else if (lvl === 2) { newLevel = 3; newValue = 7;      newNoQ = 4 }
    else return { ok: false, error: 'No se puede cantar Real Envido ahora' }
  } else if (callType === 'falta_envido') {
    if (lvl >= 4) return { ok: false, error: 'Ya se cantó Falta Envido' }
    newLevel = 4; newValue = faltaVal(state.scores); newNoQ = lvl === 0 ? 1 : curVal
  } else {
    return { ok: false, error: 'Tipo inválido' }
  }

  ev.pending = true; ev.calledBy = playerIndex; ev.level = newLevel; ev.value = newValue; ev.noQValue = newNoQ
  state.cur  = (playerIndex + 1) % state.numPlayers
  return { ok: true }
}

// ── Truco ─────────────────────────────────────────────────────────────────────

function actTruco(state, playerIndex, targetLevel) {
  if (state.envido.pending)
    return { ok: false, error: 'Responde el Envido primero' }
  if (state.truco.done)
    return { ok: false, error: 'El Truco ya terminó' }
  if (state.truco.pending && teamOf(playerIndex) === teamOf(state.truco.calledBy))
    return { ok: false, error: 'Esperando respuesta del oponente' }
  if (!state.truco.pending && targetLevel !== 1)
    return { ok: false, error: 'Debe cantar Truco primero' }
  if (state.truco.pending && targetLevel !== state.truco.level + 1)
    return { ok: false, error: 'Debe subir de a un nivel' }
  if (targetLevel > 3)
    return { ok: false, error: 'Nivel máximo alcanzado' }

  const vals = [0, 2, 3, 4], noQVals = [0, 1, 2, 3]
  const tr = state.truco
  tr.pending = true; tr.calledBy = playerIndex; tr.level = targetLevel; tr.value = vals[targetLevel]; tr.noQValue = noQVals[targetLevel]
  state.cur  = (playerIndex + 1) % state.numPlayers
  return { ok: true }
}

// ── Quiero / No Quiero ────────────────────────────────────────────────────────

function actQuiero(state, playerIndex) {
  if (state.envido.pending) {
    const ev = state.envido
    ev.pending = false; ev.done = true
    const s0 = envidoTeamScore(state, 0), s1 = envidoTeamScore(state, 1)
    ev.scores     = state.initialHands.map(h => calcEnvido(h))
    ev.showScores = true
    const winner  = s0 > s1 ? 0 : s1 > s0 ? 1 : teamOf(state.mano)
    ev.winner = winner; ev.points = ev.value
    givePoints(state, winner, ev.value)

    if (state.over) {
      state.handResult = {
        winner, winnerName: teamName(state, winner),
        tricks: [...state.tricks], trucoPoints: 0, trucoLevel: 0,
        envido: { winner, winnerName: teamName(state, winner), points: ev.value, scores: ev.scores },
        scores: [...state.scores],
      }
      state.phase = 'game_over'
      return { ok: true }
    }
    state.cur = state.trickCur
    return { ok: true }
  }

  if (state.truco.pending) {
    state.truco.pending = false; state.truco.done = true
    state.cur = state.trickCur
    return { ok: true }
  }

  return { ok: false, error: 'No hay apuesta pendiente' }
}

function actNoQuiero(state, playerIndex) {
  if (state.envido.pending) {
    const ev = state.envido
    ev.pending = false; ev.done = true
    ev.winner  = teamOf(ev.calledBy); ev.points = ev.noQValue
    givePoints(state, ev.winner, ev.noQValue)

    if (state.over) {
      state.handResult = {
        winner: ev.winner, winnerName: teamName(state, ev.winner),
        tricks: [...state.tricks], trucoPoints: 0, trucoLevel: 0,
        envido: { winner: ev.winner, winnerName: teamName(state, ev.winner), points: ev.noQValue, scores: null },
        scores: [...state.scores],
      }
      state.phase = 'game_over'
      return { ok: true }
    }
    state.cur = state.trickCur
    return { ok: true }
  }

  if (state.truco.pending) {
    const tr = state.truco
    tr.pending = false; tr.done = true; tr.rejected = true
    const winnerTeam = teamOf(tr.calledBy)
    givePoints(state, winnerTeam, tr.noQValue)

    if (!state.envido.done) state.envido.done = true
    state.handResult = {
      winner:        winnerTeam,
      winnerName:    teamName(state, winnerTeam),
      tricks:        [...state.tricks],
      lastTrickCards:state.lastTrickCards,
      trucoPoints:   tr.noQValue,
      trucoLevel:    tr.level,
      trucoRejected: true,
      envido:        envidoResultForHand(state),
      scores:        [...state.scores],
    }
    state.phase = state.over ? 'game_over' : 'hand_result'
    return { ok: true }
  }

  return { ok: false, error: 'No hay apuesta pendiente' }
}

function actNextHand(state) {
  if (state.phase !== 'hand_result') return { ok: false, error: 'No es el momento' }
  dealHand(state)
  return { ok: true }
}
