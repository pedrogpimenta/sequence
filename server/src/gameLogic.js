export const BOARD = [
  ['FREE','2♠','3♠','4♠','5♠','6♠','7♠','8♠','9♠','FREE'],
  ['6♣','5♥','4♥','3♥','2♥','2♦','3♦','4♦','5♦','10♠'],
  ['5♣','6♥','K♦','A♦','A♣','K♣','Q♣','10♣','6♦','Q♠'],
  ['4♣','7♥','Q♦','Q♥','10♥','9♥','8♥','9♣','7♦','K♠'],
  ['3♣','8♥','K♥','A♥','2♣','7♣','8♣','8♦','10♦','A♠'],
  ['2♣','9♥','10♦','K♦','3♥','4♥','5♥','9♣','9♦','2♠'],
  ['A♣','10♥','Q♦','A♦','6♥','7♥','2♥','8♦','Q♠','3♠'],
  ['K♣','Q♥','10♠','9♠','8♠','7♠','6♠','5♠','4♠','K♠'],
  ['Q♣','K♥','A♥','A♠','2♦','3♦','4♦','5♦','6♦','7♦'],
  ['FREE','9♦','3♣','4♣','5♣','6♣','7♣','8♣','10♣','FREE'],
]

const ONE_EYE = new Set(['J♥', 'J♠'])
const TWO_EYE = new Set(['J♦', 'J♣'])
export const isOneEye = c => ONE_EYE.has(c)
export const isTwoEye = c => TWO_EYE.has(c)
export const isJack = c => ONE_EYE.has(c) || TWO_EYE.has(c)
export const rank = c => c.slice(0, -1)
export const suitChar = c => c.slice(-1)
export const isRed = c => c.endsWith('♥') || c.endsWith('♦')

function buildDeck() {
  const suits = ['♠', '♥', '♦', '♣']
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const d = []
  for (let i = 0; i < 2; i++)
    for (const s of suits)
      for (const r of ranks) d.push(r + s)
  return d
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function positionsFor(card) {
  const out = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (BOARD[r][c] === card) out.push([r, c])
  return out
}

export function validPositions(state, card) {
  const opp = `p${1 - state.cur}`
  if (isTwoEye(card)) {
    const out = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (BOARD[r][c] !== 'FREE' && state.board[r][c] === null) out.push([r, c])
    return out
  }
  if (isOneEye(card)) {
    const out = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (state.board[r][c] === opp && !state.locked[r][c]) out.push([r, c])
    return out
  }
  return positionsFor(card).filter(([r, c]) => state.board[r][c] === null)
}

export function isDead(state, card) {
  if (isJack(card)) return validPositions(state, card).length === 0
  return positionsFor(card).every(([r, c]) => state.board[r][c] !== null)
}

function checkSequences(state) {
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]
  const newLock = Array.from({ length: 10 }, () => Array(10).fill(false))
  const counts = [0, 0]
  for (let pi = 0; pi < 2; pi++) {
    const player = `p${pi}`
    for (const [dr, dc] of DIRS) {
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
        const cells = []
        let ok = true
        for (let k = 0; k < 5; k++) {
          const nr = r + dr * k, nc = c + dc * k
          if (nr < 0 || nr >= 10 || nc < 0 || nc >= 10) { ok = false; break }
          if (state.board[nr][nc] !== player && BOARD[nr][nc] !== 'FREE') { ok = false; break }
          cells.push([nr, nc])
        }
        if (ok && cells.length === 5 && !cells.every(([r2, c2]) => state.locked[r2][c2])) {
          counts[pi]++
          cells.forEach(([r2, c2]) => newLock[r2][c2] = true)
        }
      }
    }
  }
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (newLock[r][c]) state.locked[r][c] = true
  state.seqs = counts
}

function takeSnapshot(state) {
  state.snapshot = {
    board: state.board.map(r => [...r]),
    locked: state.locked.map(r => [...r]),
    seqs: [...state.seqs],
    hand: [...state.hands[state.cur]],
    deck: [...state.deck],
  }
}

export function buildInitialState(name0, name1) {
  const deck = shuffle(buildDeck())
  return {
    board: Array.from({ length: 10 }, () => Array(10).fill(null)),
    locked: Array.from({ length: 10 }, () => Array(10).fill(false)),
    hands: [deck.splice(0, 7), deck.splice(0, 7)],
    deck,
    cur: 0,
    seqs: [0, 0],
    selCard: null,
    mode: 'idle',
    actionTaken: false,
    over: false,
    winner: null,
    names: [name0, name1],
    snapshot: null,
  }
}

export function getPlayerView(state, playerIndex) {
  return {
    board: state.board,
    locked: state.locked,
    seqs: state.seqs,
    deckCount: state.deck.length,
    myHand: state.hands[playerIndex],
    oppHandCount: state.hands[1 - playerIndex].length,
    cur: state.cur,
    selCard: state.cur === playerIndex ? state.selCard : null,
    mode: state.cur === playerIndex ? state.mode : 'idle',
    actionTaken: state.cur === playerIndex ? state.actionTaken : false,
    over: state.over,
    winner: state.winner,
    names: state.names,
    myIndex: playerIndex,
  }
}

export function handleAction(state, playerIndex, msg) {
  if (state.over) return { ok: false, error: 'Game is over' }
  if (state.cur !== playerIndex) return { ok: false, error: 'Not your turn' }

  switch (msg.type) {
    case 'select_card':  return actionSelectCard(state, msg.cardIndex)
    case 'place_chip':   return actionPlaceChip(state, playerIndex, msg.row, msg.col)
    case 'discard_dead': return actionDiscardDead(state, playerIndex)
    case 'cancel_sel':   return actionCancelSel(state)
    case 'undo_action':  return actionUndo(state)
    case 'end_turn':     return actionEndTurn(state)
    default:             return { ok: false, error: 'Unknown action' }
  }
}

function actionSelectCard(state, cardIndex) {
  if (state.actionTaken) return { ok: false, error: 'Action already taken this turn' }
  if (cardIndex < 0 || cardIndex >= state.hands[state.cur].length)
    return { ok: false, error: 'Invalid card index' }
  state.selCard = cardIndex
  const card = state.hands[state.cur][cardIndex]
  state.mode = isOneEye(card) ? 'remove' : 'place'
  return { ok: true }
}

function actionPlaceChip(state, playerIndex, r, c) {
  if (state.selCard === null) return { ok: false, error: 'No card selected' }
  const card = state.hands[state.cur][state.selCard]
  const valid = validPositions(state, card)
  if (!valid.some(([vr, vc]) => vr === r && vc === c))
    return { ok: false, error: 'Invalid position for this card' }

  takeSnapshot(state)

  if (state.mode === 'remove') {
    state.board[r][c] = null
  } else {
    state.board[r][c] = `p${playerIndex}`
    checkSequences(state)
    if (state.seqs[playerIndex] >= 2) {
      state.over = true
      state.winner = playerIndex
    }
  }

  state.hands[state.cur].splice(state.selCard, 1)
  if (state.deck.length > 0) state.hands[state.cur].push(state.deck.pop())
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = true
  return { ok: true }
}

function actionDiscardDead(state, playerIndex) {
  if (state.selCard === null) return { ok: false, error: 'No card selected' }
  const card = state.hands[state.cur][state.selCard]
  if (!isDead(state, card)) return { ok: false, error: 'Card is not dead' }

  takeSnapshot(state)
  state.hands[state.cur].splice(state.selCard, 1)
  if (state.deck.length > 0) state.hands[state.cur].push(state.deck.pop())
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = true
  return { ok: true }
}

function actionCancelSel(state) {
  if (state.actionTaken) return { ok: false, error: 'Cannot cancel after action is taken' }
  state.selCard = null
  state.mode = 'idle'
  return { ok: true }
}

function actionUndo(state) {
  if (!state.snapshot) return { ok: false, error: 'Nothing to undo' }
  const snap = state.snapshot
  state.board = snap.board
  state.locked = snap.locked
  state.seqs = snap.seqs
  state.hands[state.cur] = snap.hand
  state.deck = snap.deck
  state.snapshot = null
  state.actionTaken = false
  state.selCard = null
  state.mode = 'idle'
  state.over = false
  state.winner = null
  return { ok: true }
}

function actionEndTurn(state) {
  if (!state.actionTaken) return { ok: false, error: 'Must take an action before ending turn' }
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = false
  state.snapshot = null
  state.cur = 1 - state.cur
  return { ok: true }
}
