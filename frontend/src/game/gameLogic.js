export const BOARD = [
  ['JOKER', '2♠', '3♠', '4♠', '5♠', '6♠', '7♠', '8♠', '9♠', 'JOKER'],
  ['6♣', '5♣', '4♣', '3♣', '2♣', 'A♥', 'K♥', 'Q♥', '10♥', '10♠'],
  ['7♣', 'A♠', '2♦', '3♦', '4♦', '5♦', '6♦', '7♦', '9♥', 'Q♠'],
  ['8♣', 'K♠', '6♣', '5♣', '4♣', '3♣', '2♣', '8♦', '8♥', 'K♠'],
  ['9♣', 'Q♠', '7♣', '6♥', '5♥', '4♥', 'A♥', '9♦', '7♥', 'A♠'],
  ['10♣', '10♠', '8♣', '7♥', '2♥', '3♥', 'K♥', '10♦', '6♥', '2♦'],
  ['Q♣', '9♠', '9♣', '8♥', '9♥', '10♥', 'Q♥', 'Q♦', '5♥', '3♦'],
  ['K♣', '8♠', '10♣', 'Q♣', 'K♣', 'A♣', 'A♦', 'K♥', '4♥', '4♦'],
  ['A♣', '7♠', '6♠', '5♠', '4♠', '3♠', '2♠', '2♣', '3♣', '5♦'],
  ['JOKER', 'A♦', 'K♦', 'Q♦', '10♦', '9♦', '8♦', '7♦', '6♦', 'JOKER'],
]

const ONE_EYE = new Set(['J♥', 'J♠'])
const TWO_EYE = new Set(['J♦', 'J♣'])
export const isOneEye = c => ONE_EYE.has(c)
export const isTwoEye = c => TWO_EYE.has(c)
export const isJack   = c => ONE_EYE.has(c) || TWO_EYE.has(c)
export const rank     = c => c.slice(0, -1)
export const suitChar = c => c.slice(-1)
export const isRed    = c => c.endsWith('♥') || c.endsWith('♦')

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
        if (BOARD[r][c] !== 'JOKER' && state.board[r][c] === null) out.push([r, c])
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
    lastChip: null,
    pendingLastChip: null,
  }
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
          if (state.board[nr][nc] !== player && BOARD[nr][nc] !== 'JOKER') { ok = false; break }
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
  state.seqs[0] += counts[0]
  state.seqs[1] += counts[1]
}

function takeSnapshot(state) {
  state.snapshot = {
    board: state.board.map(r => [...r]),
    locked: state.locked.map(r => [...r]),
    seqs: [...state.seqs],
    hand: [...state.hands[state.cur]],
    deck: [...state.deck],
    lastChip: state.lastChip,
    pendingLastChip: state.pendingLastChip,
  }
}

// ── Local game mutations ─────────────────────────────────────────────────────

export function localSelectCard(state, cardIndex) {
  if (state.over || state.actionTaken) return
  state.selCard = cardIndex
  const card = state.hands[state.cur][cardIndex]
  state.mode = isOneEye(card) ? 'remove' : 'place'
}

export function localCellClick(state, r, c) {
  if (state.over || state.selCard === null) return
  const card = state.hands[state.cur][state.selCard]
  const valid = validPositions(state, card)
  if (!valid.some(([vr, vc]) => vr === r && vc === c)) return

  takeSnapshot(state)

  if (state.mode === 'remove') {
    state.board[r][c] = null
  } else {
    state.board[r][c] = `p${state.cur}`
    state.pendingLastChip = { r, c }
    checkSequences(state)
    if (state.seqs[state.cur] >= 2) {
      state.over = true
      state.winner = state.cur
    }
  }

  state.hands[state.cur].splice(state.selCard, 1)
  if (state.deck.length > 0) state.hands[state.cur].push(state.deck.pop())
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = true
}

export function localDiscardDead(state) {
  if (state.selCard === null) return
  const card = state.hands[state.cur][state.selCard]
  if (!isDead(state, card)) return
  takeSnapshot(state)
  state.hands[state.cur].splice(state.selCard, 1)
  if (state.deck.length > 0) state.hands[state.cur].push(state.deck.pop())
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = true
}

export function localCancelSel(state) {
  if (state.actionTaken) return
  state.selCard = null
  state.mode = 'idle'
}

export function localUndo(state) {
  if (!state.snapshot) return
  const snap = state.snapshot
  state.board = snap.board
  state.locked = snap.locked
  state.seqs = snap.seqs
  state.hands[state.cur] = snap.hand
  state.deck = snap.deck
  state.lastChip = snap.lastChip
  state.pendingLastChip = snap.pendingLastChip
  state.snapshot = null
  state.actionTaken = false
  state.selCard = null
  state.mode = 'idle'
  state.over = false
  state.winner = null
}

export function localEndTurn(state) {
  if (!state.actionTaken || state.over) return
  state.lastChip = state.pendingLastChip
  state.pendingLastChip = null
  state.selCard = null
  state.mode = 'idle'
  state.actionTaken = false
  state.snapshot = null
  state.cur = 1 - state.cur
}
