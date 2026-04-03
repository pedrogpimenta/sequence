import Koa from 'koa'
import Router from '@koa/router'
import { WebSocketServer } from 'ws'
import http from 'http'
import { handleMessage, handleDisconnect } from './rooms.js'

const app = new Koa()
const router = new Router()

router.get('/health', ctx => { ctx.body = 'ok' })

app.use(router.routes()).use(router.allowedMethods())

const server = http.createServer(app.callback())
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  let roomCode = null
  let playerIndex = null

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data) } catch { return }

    const result = handleMessage(ws, msg, { roomCode, playerIndex })
    if (result.roomCode != null) roomCode = result.roomCode
    if (result.playerIndex != null) playerIndex = result.playerIndex
  })

  ws.on('close', () => {
    if (roomCode != null && playerIndex != null) {
      handleDisconnect(roomCode, playerIndex)
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
  })
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => console.log(`Sequence server listening on :${PORT}`))
