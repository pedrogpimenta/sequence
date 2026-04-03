import { buildInitialState, handleAction, getPlayerView } from './gameLogic.js'

const rooms = new Map()

function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj))
}

function broadcastState(room) {
  for (let i = 0; i < 2; i++) {
    if (room.players[i]) {
      send(room.players[i], { type: 'state_update', ...getPlayerView(room.state, i) })
    }
  }
}

export function handleMessage(ws, msg, ctx) {
  if (msg.type === 'create_room') {
    return handleCreateRoom(ws, msg.name || 'Player 1')
  }
  if (msg.type === 'join_room') {
    return handleJoinRoom(ws, (msg.code || '').toUpperCase(), msg.name || 'Player 2')
  }

  const { roomCode, playerIndex } = ctx
  if (roomCode == null || playerIndex == null) {
    send(ws, { type: 'error', message: 'Not in a room' })
    return {}
  }

  const room = rooms.get(roomCode)
  if (!room || !room.state) {
    send(ws, { type: 'error', message: 'Room not found' })
    return {}
  }

  const result = handleAction(room.state, playerIndex, msg)
  if (result.ok) {
    broadcastState(room)
    if (room.state.over) {
      setTimeout(() => rooms.delete(roomCode), 10 * 60 * 1000)
    }
  } else {
    send(ws, { type: 'error', message: result.error })
  }
  return {}
}

function handleCreateRoom(ws, name) {
  let code
  do { code = genCode() } while (rooms.has(code))

  const room = {
    code,
    players: [ws, null],
    names: [name, null],
    state: null,
  }
  rooms.set(code, room)
  send(ws, { type: 'room_created', code, playerIndex: 0 })
  return { roomCode: code, playerIndex: 0 }
}

function handleJoinRoom(ws, code, name) {
  const room = rooms.get(code)
  if (!room) {
    send(ws, { type: 'error', message: `Room "${code}" not found` })
    return {}
  }
  if (room.players[1]) {
    send(ws, { type: 'error', message: 'Room is full' })
    return {}
  }

  room.players[1] = ws
  room.names[1] = name
  room.state = buildInitialState(room.names[0], room.names[1])

  // Notify both players game is starting
  send(room.players[0], { type: 'game_start', ...getPlayerView(room.state, 0) })
  send(ws,              { type: 'game_start', ...getPlayerView(room.state, 1) })

  return { roomCode: code, playerIndex: 1 }
}

export function handleDisconnect(roomCode, playerIndex) {
  const room = rooms.get(roomCode)
  if (!room) return
  const otherIdx = 1 - playerIndex
  if (room.players[otherIdx]) {
    send(room.players[otherIdx], { type: 'opponent_disconnected' })
  }
  rooms.delete(roomCode)
}

export function getRoom(code) {
  return rooms.get(code)
}
