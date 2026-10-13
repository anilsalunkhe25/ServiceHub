import { createHash } from 'node:crypto'
import type { Request, Response } from 'express'
import { Payment, databaseReady } from '../config/appState.js'
import { getRazorpayCredentials } from '../config/razorpay.js'
import { verifyRazorpayWebhookSignature } from '../utils/paymentHelpers.js'
import { applyRefundWebhook, handleCapturedWebhook, markPaymentFailed } from './paymentController.js'

type GatewayWebhookEvent = {
  event?: string
  payload?: {
    payment?: { entity?: { 
      id: string; 
      order_id: string; 
      amount: number | string; 
      currency: string; 
      status: string; 
      captured: boolean; 
      method?: string 
    } }
    refund?: { entity?: { 
      id: string; 
      payment_id: string; 
      status: string; 
      receipt?: string; 
      notes?: Record<string, string> } }
  }
}

export async function processRazorpayWebhook(request: Request, response: Response) {
  if (!Buffer.isBuffer(request.body)) return response.status(400).json({ success: false, message: 'Expected raw webhook payload' })

  let secret: string
  try {
    secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
    if (!secret) return response.status(503).json({ success: false, message: 'Webhook secret is not configured' })
  } catch {
    return response.status(503).json({ success: false, message: 'Webhook is not configured' })
  }

  const signature = request.get('x-razorpay-signature') || ''
  if (!verifyRazorpayWebhookSignature(request.body, signature, secret)) {
    return response.status(400).json({ success: false, message: 'Invalid webhook signature' })
  }
  if (!databaseReady) return response.status(503).json({ success: false, message: 'Payment storage is unavailable' })

  let event: GatewayWebhookEvent
  try {
    event = JSON.parse(request.body.toString('utf8')) as GatewayWebhookEvent
  } catch {
    return response.status(400).json({ success: false, message: 'Invalid webhook payload' })
  }

  const eventId = request.get('x-razorpay-event-id') || createHash('sha256').update(request.body).digest('hex')
  try {
    if (event.event === 'payment.captured' && event.payload?.payment?.entity) {
      await handleCapturedWebhook(event.payload.payment.entity, eventId)
    } else if (event.event === 'payment.failed' && event.payload?.payment?.entity) {
      const gatewayPayment = event.payload.payment.entity
      const payment = await Payment.findOne({ 'attempts.orderId': gatewayPayment.order_id })
      if (payment && !payment.processedWebhookEventIds.includes(eventId)) {
        await markPaymentFailed(payment, gatewayPayment.order_id, eventId)
      }
    } else if ((event.event === 'refund.processed' || event.event === 'refund.failed') && event.payload?.refund?.entity) {
      const refund = event.payload.refund.entity
      const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id })
      if (payment && !payment.processedWebhookEventIds.includes(eventId)) await applyRefundWebhook(refund, eventId)
    }
    response.json({ success: true, received: true })
  } catch {
    response.status(500).json({ success: false, message: 'Webhook processing failed; Razorpay may retry this event' })
  }
}