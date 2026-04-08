import { buildInitialState as buildSeqState, handleAction as handleSeqAction, getPlayerView as getSeqView } from './gameLogic.js'
import { buildInitialState as buildTrucoState, handleAction as handleTrucoAction, getPlayerView as getTrucoView } from './trucoLogic.js'
import { saveRoom, loadRoom, deleteRoom, codeExists } from './db.js'

// In-memory map: code → { code, players: [ws|null, ...], names, state, gameType, numPlayers }
const rooms = new Map()

function gameHandlers(gameType) {
  if (gameType === 'truco') return {
    buildState: (names) => buildTrucoState(names),
    handleAction: handleTrucoAction,
    getView: getTrucoView,
  }
  return {
    buildState: (names) => buildSeqState(names[0], names[1]),
    handleAction: handleSeqAction,
    getView: getSeqView,
  }
}

function detectGameType(state) {
  return state?.gameType === 'truco' ? 'truco' : 'sequence'
}

function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj))
}

function broadcastState(room) {
  const gt = detectGameType(room.state)
  const { getView } = gameHandlers(gt)
  for (let i = 0; i < room.players.length; i++) {
    if (room.players[i]) {
      send(room.players[i], { type: 'state_update', ...getView(room.state, i) })
    }
  }
}

function persistRoom(room) {
  saveRoom(room.code, room.names, room.state)
}

// ── Public handlers ───────────────────────────────────────────────────────────

export function handleMessage(ws, msg, ctx) {
  if (msg.type === 'create_room') return handleCreate(ws, msg.name || 'Player 1', msg.gameType || 'sequence', msg.numPlayers || 2)
  if (msg.type === 'join_room')   return handleJoin(ws, (msg.code || '').toUpperCase(), msg.name || 'Player', msg.gameType || 'sequence')

  const { roomCode, playerIndex } = ctx
  if (roomCode == null || playerIndex == null) {
    send(ws, { type: 'error', message: 'Not in a room' })
    return {}
  }

  const room = rooms.get(roomCode)
  if (!room?.state) {
    send(ws, { type: 'error', message: 'Room not found' })
    return {}
  }

  const gt = detectGameType(room.state)
  const { handleAction } = gameHandlers(gt)

  const result = handleAction(room.state, playerIndex, msg)
  if (result.ok) {
    persistRoom(room)
    broadcastState(room)
    if (room.state.over) {
      setTimeout(() => { deleteRoom(roomCode); rooms.delete(roomCode) }, 10 * 60 * 1000)
    }
  } else {
    send(ws, { type: 'error', message: result.error })
  }
  return {}
}

export function handleDisconnect(roomCode, playerIndex) {
  const room = rooms.get(roomCode)
  if (!room) return

  room.players[playerIndex] = null
  for (let i = 0; i < room.players.length; i++) {
    if (room.players[i]) send(room.players[i], { type: 'opponent_disconnected' })
  }

  if (room.players.every(p => p === null)) rooms.delete(roomCode)
}

// ── Room creation ─────────────────────────────────────────────────────────────

function handleCreate(ws, name, gameType, numPlayers) {
  let code
  do { code = genCode() } while (rooms.has(code) || codeExists(code))

  const n = (gameType === 'truco' && numPlayers === 4) ? 4 : 2
  const names   = new Array(n).fill(null); names[0] = name
  const players = new Array(n).fill(null); players[0] = ws

  const room = { code, players, names, state: null, gameType, numPlayers: n }
  rooms.set(code, room)
  saveRoom(code, names, null)

  send(ws, { type: 'room_created', code, playerIndex: 0, numPlayers: n, joined: 1 })
  return { roomCode: code, playerIndex: 0 }
}

// ── Join / reconnect ──────────────────────────────────────────────────────────

function handleJoin(ws, code, name, gameType) {
  let room = rooms.get(code)
  if (!room) {
    const record = loadRoom(code)
    if (!record) {
      send(ws, { type: 'error', message: `Room "${code}" not found` })
      return {}
    }
    const gt = record.state ? detectGameType(record.state) : gameType
    const n  = record.names.length
    room = { code, players: new Array(n).fill(null), names: record.names, state: record.state, gameType: gt, numPlayers: n }
    rooms.set(code, room)
  }

  const { names, state, players } = room
  const n = room.numPlayers

  // ── Game in progress — reconnect by name match ────────────────────────────
  if (state) {
    const gt = detectGameType(state)
    const { getView } = gameHandlers(gt)
    const idx = names.findIndex(nm => nm === name)
    if (idx !== -1) {
      room.players[idx] = ws
      send(ws, { type: 'game_resume', ...getView(state, idx) })
      for (let i = 0; i < n; i++) {
        if (i !== idx && players[i]) send(players[i], { type: 'opponent_reconnected', name: names[idx] })
      }
      return { roomCode: code, playerIndex: idx }
    }
    send(ws, { type: 'error', message: 'A game is already in progress in this room' })
    return {}
  }

  // ── Waiting for players (game not started yet) ────────────────────────────
  // Reconnect: player already has a slot
  const existingIdx = names.findIndex(nm => nm === name)
  if (existingIdx !== -1) {
    room.players[existingIdx] = ws
    const joined = names.filter(nm => nm !== null).length
    send(ws, { type: 'room_created', code, playerIndex: existingIdx, numPlayers: n, joined })
    return { roomCode: code, playerIndex: existingIdx }
  }

  // New player taking an empty slot
  const emptySlot = names.findIndex(nm => nm === null)
  if (emptySlot === -1) {
    send(ws, { type: 'error', message: 'Room is full' })
    return {}
  }

  room.players[emptySlot] = ws
  room.names[emptySlot]   = name
  saveRoom(code, room.names, null)

  const joined = room.names.filter(nm => nm !== null).length

  if (joined === n) {
    // All players present — start game
    const { buildState, getView } = gameHandlers(room.gameType || 'sequence')
    room.state = buildState(room.names)
    persistRoom(room)
    for (let i = 0; i < n; i++) {
      send(room.players[i], { type: 'game_start', ...getView(room.state, i) })
    }
    return { roomCode: code, playerIndex: emptySlot }
  }

  // Room not yet full
  send(ws, { type: 'room_waiting', code, playerIndex: emptySlot, numPlayers: n, joined })
  for (let i = 0; i < emptySlot; i++) {
    if (room.players[i]) send(room.players[i], { type: 'player_joined', name, joined, numPlayers: n })
  }
  return { roomCode: code, playerIndex: emptySlot }
}
