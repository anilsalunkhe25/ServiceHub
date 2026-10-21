import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import test from 'node:test'
import { jwtSecret, tokenFor } from '../config/appState.js'
import { auth, optionalAuth } from './auth.js'

test('limits authenticated sessions to seven hours and ignores expired optional tokens', async (context) => {
  const app = express()
  app.get('/protected', auth('customer'), (request, response) => {
    response.json({ success: true, userId: request.user?.id })
  })
  app.get('/optional', optionalAuth, (request, response) => {
    response.json({ authenticated: Boolean(request.user) })
  })

  const server = createServer(app)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  })

  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const currentToken = tokenFor({ id: 'customer-current', role: 'customer' })
  const oldIssuedAt = Math.floor(Date.now() / 1000) - 8 * 60 * 60
  const oldToken = jwt.sign(
    { id: 'customer-old', role: 'customer', iat: oldIssuedAt },
    jwtSecret,
    { expiresIn: '2d' },
  )

  const currentSession = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${currentToken}` },
  })
  assert.equal(currentSession.status, 200)

  const expiredSession = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${oldToken}` },
  })
  assert.equal(expiredSession.status, 401)
  assert.deepEqual(await expiredSession.json(), {
    success: false,
    message: 'Invalid or expired token',
  })

  const optionalExpiredSession = await fetch(`${baseUrl}/optional`, {
    headers: { Authorization: `Bearer ${oldToken}` },
  })
  assert.equal(optionalExpiredSession.status, 200)
  assert.deepEqual(await optionalExpiredSession.json(), { authenticated: false })
})
