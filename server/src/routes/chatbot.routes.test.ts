import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import express from 'express'
import test from 'node:test'
import { demoBookings, tokenFor } from '../config/appState.js'
import chatbotRoutes from './chatbot.routes.js'

test('validates chat input, handles expired optional tokens, and provides booking guidance', async (context) => {
  const previousApiKey = process.env.GEMINI_API_KEY
  const previousBookings = [...demoBookings]
  delete process.env.GEMINI_API_KEY
  demoBookings.splice(0, demoBookings.length,
    {
      _id: 'booking-owned',
      customerId: 'chat-test-customer',
      service: 'Home cleaning',
      date: '2026-10-22',
      time: '10:00 AM',
      address: 'Private address',
      bookingStatus: 'accepted',
    },
    {
      _id: 'booking-other',
      customerId: 'another-customer',
      service: 'Private plumbing request',
      date: '2026-10-23',
      time: '11:00 AM',
      address: 'Another private address',
      bookingStatus: 'pending',
    },
  )

  const app = express()
  app.use(express.json())
  app.use('/api/chatbot', chatbotRoutes)

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
    if (previousApiKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = previousApiKey
    demoBookings.splice(0, demoBookings.length, ...previousBookings)
  })

  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/api/chatbot/message`

  const emptyMessage = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '   ' }),
  })
  assert.equal(emptyMessage.status, 400)
  assert.deepEqual(await emptyMessage.json(), { success: false, message: 'Enter a message to continue.' })

  const oversizedMessage = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'a'.repeat(2001) }),
  })
  assert.equal(oversizedMessage.status, 400)

  const greetingResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hi!' }),
  })
  assert.equal(greetingResponse.status, 200)
  const greeting = await greetingResponse.json() as { success: boolean; reply: string }
  assert.equal(greeting.success, true)
  assert.match(greeting.reply, /^Hi! How can I help you today\?/)

  const generalBookingQuestion = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer expired-token` },
    body: JSON.stringify({ message: 'How do I manage a booking?' }),
  })
  assert.equal(generalBookingQuestion.status, 200)
  const bookingGuide = await generalBookingQuestion.json() as { success: boolean; reply: string }
  assert.equal(bookingGuide.success, true)
  assert.match(bookingGuide.reply, /Open your Dashboard/)
  assert.match(bookingGuide.reply, /Pending or Accepted/)
  assert.doesNotMatch(bookingGuide.reply, /Invalid or expired token/)

  const invalidToken = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-token' },
    body: JSON.stringify({ message: 'How do I book a service?' }),
  })
  assert.equal(invalidToken.status, 200)
  const invalidTokenReply = await invalidToken.json() as { reply: string }
  assert.match(invalidTokenReply.reply, /To book a service/)

  const unconfigured = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How do payments work?' }),
  })
  assert.equal(unconfigured.status, 200)
  const paymentGuide = await unconfigured.json() as { success: boolean; reply: string }
  assert.equal(paymentGuide.success, true)
  assert.match(paymentGuide.reply, /Cash on delivery/)
  assert.match(paymentGuide.reply, /Razorpay/)
  assert.match(paymentGuide.reply, /UPI, cards, net banking, or wallets/)

  const servicesGuideResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What services can I book?' }),
  })
  assert.equal(servicesGuideResponse.status, 200)
  const servicesGuide = await servicesGuideResponse.json() as { reply: string }
  assert.match(servicesGuide.reply, /Home repair/)
  assert.match(servicesGuide.reply, /Cleaning/)
  assert.match(servicesGuide.reply, /Explore services/)

  const providerGuideResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'How do I join as a service provider?' }),
  })
  const providerGuide = await providerGuideResponse.json() as { reply: string }
  assert.match(providerGuide.reply, /Service provider/)
  assert.match(providerGuide.reply, /Dashboard/)

  const statusGuideResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What do booking statuses mean?' }),
  })
  const statusGuide = await statusGuideResponse.json() as { reply: string }
  assert.match(statusGuide.reply, /Pending/)
  assert.match(statusGuide.reply, /In progress/)

  const refundGuide = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Can I get a refund if I cancel?' }),
  })
  assert.equal(refundGuide.status, 200)
  const refundReply = await refundGuide.json() as { reply: string }
  assert.match(refundReply.reply, /does not publish customer refund eligibility/)

  const support = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Can I speak to human support?' }),
  })
  assert.equal(support.status, 200)
  const supportGuide = await support.json() as { reply: string }
  assert.match(supportGuide.reply, /message the provider/)
  assert.match(supportGuide.reply, /does not currently show a separate customer-support/)

  const privateQuestionWithExpiredToken = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired-token' },
    body: JSON.stringify({ message: 'What are my bookings?' }),
  })
  assert.equal(privateQuestionWithExpiredToken.status, 200)
  const loginGuidance = await privateQuestionWithExpiredToken.json() as { reply: string; privateData: boolean }
  assert.equal(loginGuidance.privateData, true)
  assert.match(loginGuidance.reply, /Your session may have expired/)

  const privateBooking = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor({ id: 'chat-test-customer', role: 'customer' })}`,
    },
    body: JSON.stringify({ message: 'What are my bookings?', userId: 'another-customer' }),
  })
  assert.equal(privateBooking.status, 200)
  const privateReply = await privateBooking.json() as { reply: string; privateData: boolean }
  assert.equal(privateReply.privateData, true)
  assert.match(privateReply.reply, /Home cleaning/)
  assert.doesNotMatch(privateReply.reply, /Private plumbing request|Private address|Another private address/)
})
