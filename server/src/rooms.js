import { buildInitialState as buildSeqState, handleAction as handleSeqAction, getPlayerView as getSeqView } from './gameLogic.js'
import { buildInitialState as buildTrucoState, handleAction as handleTrucoAction, getPlayerView as getTrucoView } from './trucoLogic.js'
import { saveRoom, loadRoom, deleteRoom, codeExists } from './db.js'

// In-memory map: code → { code, players: [ws|null, ws|null], names, state }
const rooms = new Map()

function gameHandlers(gameType) {
  if (gameType === 'truco') return { buildState: buildTrucoState, handleAction: handleTrucoAction, getView: getTrucoView }
  return { buildState: buildSeqState, handleAction: handleSeqAction, getView: getSeqView }
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
  const gt  = detectGameType(room.state)
  const { getView } = gameHandlers(gt)
  for (let i = 0; i < 2; i++) {
    if (room.players[i]) {
      send(room.players[i], { type: 'state_update', ...getView(room.state, i) })
    }
  }
}

function persistRoom(room) {
  saveRoom(room.code, room.names, room.state)
}

// ── Public handlers ──────────────────────────────────────────────────────────

export function handleMessage(ws, msg, ctx) {
  if (msg.type === 'create_room') return handleCreate(ws, msg.name || 'Player 1', msg.gameType || 'sequence')
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
  const other = room.players[1 - playerIndex]
  if (other) send(other, { type: 'opponent_disconnected' })

  if (!room.players[0] && !room.players[1]) rooms.delete(roomCode)
}

// ── Room creation ────────────────────────────────────────────────────────────

function handleCreate(ws, name, gameType) {
  let code
  do { code = genCode() } while (rooms.has(code) || codeExists(code))

  const room = { code, players: [ws, null], names: [name, null], state: null, gameType }
  rooms.set(code, room)
  saveRoom(code, [name, null], null)

  send(ws, { type: 'room_created', code, playerIndex: 0 })
  return { roomCode: code, playerIndex: 0 }
}

// ── Join / reconnect ─────────────────────────────────────────────────────────

function handleJoin(ws, code, name, gameType) {
  let room = rooms.get(code)
  if (!room) {
    const record = loadRoom(code)
    if (!record) {
      send(ws, { type: 'error', message: `Room "${code}" not found` })
      return {}
    }
    const gt = record.state ? detectGameType(record.state) : gameType
    room = { code, players: [null, null], names: record.names, state: record.state, gameType: gt }
    rooms.set(code, room)
  }

  const { names, state, players } = room

  // ── Waiting for P2 (game not started yet) ─────────────────────────────────
  if (!state) {
    if (name === names[0]) {
      room.players[0] = ws
      send(ws, { type: 'room_created', code, playerIndex: 0 })
      return { roomCode: code, playerIndex: 0 }
    }
    if (!names[1]) {
      room.players[1] = ws
      room.names[1]   = name
      const { buildState, getView } = gameHandlers(room.gameType || 'sequence')
      room.state = buildState(names[0], name)
      persistRoom(room)
      send(players[0], { type: 'game_start', ...getView(room.state, 0) })
      send(ws,         { type: 'game_start', ...getView(room.state, 1) })
      return { roomCode: code, playerIndex: 1 }
    }
    send(ws, { type: 'error', message: 'Room is full' })
    return {}
  }

  // ── Game in progress — reconnect by name match ────────────────────────────
  const gt = detectGameType(state)
  const { getView } = gameHandlers(gt)

  if (name === names[0]) {
    room.players[0] = ws
    send(ws, { type: 'game_resume', ...getView(state, 0) })
    if (players[1]) send(players[1], { type: 'opponent_reconnected', name: names[0] })
    return { roomCode: code, playerIndex: 0 }
  }
  if (name === names[1]) {
    room.players[1] = ws
    send(ws, { type: 'game_resume', ...getView(state, 1) })
    if (players[0]) send(players[0], { type: 'opponent_reconnected', name: names[1] })
    return { roomCode: code, playerIndex: 1 }
  }

  send(ws, { type: 'error', message: 'A game is already in progress in this room' })
  return {}
}
