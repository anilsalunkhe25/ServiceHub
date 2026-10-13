import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import type { Request, Response } from 'express'
import { Booking, Payment, Provider, databaseReady } from '../config/appState.js'
import { getRazorpayClient, getRazorpayCredentials } from '../config/razorpay.js'
import { canRetryPayment, getBasePricePaise, getBookingIntentKey, getRemainingRefundablePaise, verifyRazorpayPaymentSignature } from '../utils/paymentHelpers.js'

type BookingDraft = {
  service: string
  providerBusinessName: string
  packageId?: string
  packageName?: string
  date: string
  time: string
  address: string
  description: string
  urgent: boolean
}

type GatewayPayment = {
  id: string
  order_id: string
  amount: number | string
  currency: string
  status: string
  captured: boolean
  method?: string
}

function paymentResponse(payment: any) {
  return {
    _id: String(payment._id),
    customerId: String(payment.customerId),
    bookingId: payment.bookingId ? String(payment.bookingId) : undefined,
    providerId: String(payment.providerId),
    bookingDetails: payment.bookingDetails,
    amountPaise: payment.amountPaise,
    taxPaise: payment.taxPaise,
    feePaise: payment.feePaise,
    currency: payment.currency,
    gateway: payment.gateway,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    attempts: payment.attempts,
    refunds: payment.refunds,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  }
}

function checkoutResponse(payment: any, keyId: string) {
  return {
    payment: paymentResponse(payment),
    checkout: {
      keyId,
      orderId: payment.razorpayOrderId,
      amount: payment.amountPaise,
      currency: payment.currency,
    },
    summary: {
      service: payment.bookingDetails.service,
      packageName: payment.bookingDetails.packageName,
      provider: payment.bookingDetails.providerBusinessName,
      basePricePaise: payment.amountPaise - payment.taxPaise - payment.feePaise,
      taxPaise: payment.taxPaise,
      feePaise: payment.feePaise,
      totalPaise: payment.amountPaise,
    },
  }
}

async function createGatewayOrder(paymentId: string, allowedStatuses: string[] = ['pending', 'failed']) {
  const lock = randomUUID()
  const staleLock = new Date(Date.now() - 2 * 60 * 1000)
  const lockFilter = Payment.findById(paymentId)
    .where('status').in(allowedStatuses)
    .or([{ orderCreationLockAt: { $exists: false } }, { orderCreationLockAt: { $lt: staleLock } }])
  const claim = await Payment.updateOne(
    lockFilter,
    { $set: { orderCreationLock: lock, orderCreationLockAt: new Date(), status: 'pending' } },
  )

  if (!claim.modifiedCount) {
    const current = await Payment.findById(paymentId)
    if (current?.razorpayOrderId && current.status === 'created') return current
    throw new Error('Payment order is already being prepared')
  }
  const payment = await Payment.findById(paymentId)
  if (!payment) throw new Error('Payment record not found')

  try {
    const gateway = getRazorpayClient()
    const order = await gateway.orders.create({
      amount: payment.amountPaise,
      currency: payment.currency,
      receipt: `${String(payment._id)}-${randomUUID().slice(0, 12)}`,
      notes: {
        servicehubPaymentId: String(payment._id),
        customerId: String(payment.customerId),
        providerId: String(payment.providerId),
      },
    })

    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, orderCreationLock: lock },
      {
        $set: { status: 'created', razorpayOrderId: order.id },
        $push: { attempts: { orderId: order.id, status: 'created', createdAt: new Date() } },
        $unset: { orderCreationLock: 1, orderCreationLockAt: 1 },
      },
      { new: true, includeResultMetadata: false },
    )
    if (!updated) throw new Error('Payment order could not be saved')
    return updated
  } catch (error) {
    await Payment.updateOne(
      { _id: payment._id, orderCreationLock: lock },
      { $set: { status: 'failed' }, $unset: { orderCreationLock: 1, orderCreationLockAt: 1 } },
    )
    throw error
  }
}

export async function createPaymentOrder(request: Request, response: Response) {
  if (!databaseReady) return response.status(503).json({ success: false, message: 'Online payments require a connected database.' })

  try {
    const { keyId } = getRazorpayCredentials()
    const draft = request.body?.booking
    const idempotencyKey = String(request.get('Idempotency-Key') || request.body?.idempotencyKey || '')
    const providerId = String(draft?.providerId || '')
    if (!isValidObjectId(providerId) || !idempotencyKey || idempotencyKey.length > 128) {
      return response.status(400).json({ success: false, message: 'A valid provider and payment request key are required' })
    }
    const bookingDate = String(draft?.date || '')
    const bookingDateValue = new Date(`${bookingDate}T00:00:00.000Z`)
    const allowedTimes = new Set(['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || Number.isNaN(bookingDateValue.getTime()) || bookingDateValue.toISOString().slice(0, 10) !== bookingDate || bookingDate < new Date().toISOString().slice(0, 10) ||
      !allowedTimes.has(String(draft?.time || '')) || !String(draft?.address || '').trim() || String(draft.address).length > 500 || String(draft.description || '').length > 2000
    ) {
      return response.status(400).json({ success: false, message: 'Date, time and a valid service address are required' })
    }

    const provider = await Provider.findById(providerId)
    if (!provider || !provider.isActive || provider.isAvailable === false) {
      return response.status(409).json({ success: false, message: 'This provider is not accepting bookings' })
    }
    const packageId = String(draft.packageId || '')
    const selectedPackage = packageId ? provider.packages?.find((item) => item.id === packageId) : undefined
    if ((provider.packages?.length && !selectedPackage) || (packageId && !selectedPackage)) {
      return response.status(400).json({ success: false, message: 'Select a valid service package' })
    }
    const amountPaise = selectedPackage?.pricePaise ?? getBasePricePaise(provider.pricing)
    if (!amountPaise) return response.status(400).json({ success: false, message: 'This provider has no valid listed price for online payment' })

    const bookingDetails: BookingDraft = {
      service: provider.category || 'Service',
      providerBusinessName: provider.businessName || 'Service provider',
      packageId: selectedPackage?.id,
      packageName: selectedPackage?.name,
      date: String(draft.date),
      time: String(draft.time),
      address: String(draft.address).trim(),
      description: String(draft.description || '').trim(),
      urgent: Boolean(draft.urgent),
    }
    const customerId = String(request.user?.id || '')
    const bookingKey = getBookingIntentKey(customerId, providerId, bookingDetails.date, bookingDetails.time, bookingDetails.packageId)
    let payment = await Payment.findOne({ customerId, bookingKey })
    if (!payment) payment = await Payment.findOne({ customerId, idempotencyKey })

    if (payment) {
      if (String(payment.providerId) !== providerId || JSON.stringify(payment.bookingDetails) !== JSON.stringify(bookingDetails)) {
        return response.status(409).json({ success: false, message: 'That payment request key belongs to different booking details' })
      }
      if (payment.razorpayOrderId && payment.status === 'created') {
        return response.json({ success: true, data: checkoutResponse(payment, keyId) })
      }
      if (payment.status === 'paid' || payment.status === 'refunded') {
        return response.status(409).json({ success: false, message: 'This payment request has already completed' })
      }
    } else {
      try {
        payment = await Payment.create({
          customerId,
          providerId: provider._id,
          bookingDetails,
          amountPaise,
          taxPaise: 0,
          feePaise: 0,
          currency: 'INR',
          gateway: 'razorpay',
          status: 'pending',
          idempotencyKey,
          bookingKey,
        })
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error
        payment = await Payment.findOne({ customerId, bookingKey }) || await Payment.findOne({ customerId, idempotencyKey })
        if (!payment) throw error
      }
    }

    payment = await createGatewayOrder(String(payment._id))
    response.status(201).json({ success: true, data: checkoutResponse(payment, keyId) })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Razorpay is not configured') {
      return response.status(503).json({ success: false, message: 'Online payments are not configured. Please use Cash on delivery.' })
    }
    response.status(502).json({ success: false, message: 'Unable to create a payment order. Please try again.' })
  }
}

async function finalizeCapturedPayment(paymentId: string, gatewayPayment: GatewayPayment, webhookEventId?: string) {
  const payment = await Payment.findById(paymentId)
  if (!payment) throw new Error('Payment record not found')
  if (payment.status === 'refunded') return Booking.findOne({ paymentId: payment._id })

  const order = await getRazorpayClient().orders.fetch(gatewayPayment.order_id)
  if (
    order.id !== gatewayPayment.order_id ||
    Number(order.amount) !== payment.amountPaise ||
    order.currency !== payment.currency ||
    String(order.notes?.servicehubPaymentId) !== String(payment._id) ||
    String(order.notes?.customerId) !== String(payment.customerId) ||
    String(order.notes?.providerId) !== String(payment.providerId) ||
    Number(gatewayPayment.amount) !== payment.amountPaise ||
    gatewayPayment.currency !== payment.currency ||
    gatewayPayment.status !== 'captured' ||
    gatewayPayment.captured !== true
  ) {
    throw new Error('Gateway payment does not match the payment record')
  }

  let booking
  try {
    booking = await Booking.findOneAndUpdate(
      { paymentId: payment._id },
      {
        $setOnInsert: {
          customerId: payment.customerId,
          providerId: payment.providerId,
          providerBusinessName: payment.bookingDetails.providerBusinessName,
          service: payment.bookingDetails.service,
          servicePackageId: payment.bookingDetails.packageId,
          servicePackageName: payment.bookingDetails.packageName,
          date: payment.bookingDetails.date,
          time: payment.bookingDetails.time,
          address: payment.bookingDetails.address,
          description: payment.bookingDetails.description,
          urgent: payment.bookingDetails.urgent,
          amount: payment.amountPaise / 100,
          currency: payment.currency,
          paymentMethod: 'online',
          paymentStatus: 'paid',
          paymentId: payment._id,
          razorpayOrderId: gatewayPayment.order_id,
          razorpayPaymentId: gatewayPayment.id,
          bookingStatus: 'pending',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    booking = await Booking.findOne({ paymentId: payment._id })
    if (!booking) throw error
  }

  const update: Record<string, unknown> = {
    status: 'paid',
    bookingId: booking?._id,
    razorpayPaymentId: gatewayPayment.id,
    paymentMethod: gatewayPayment.method,
    'attempts.$[attempt].paymentId': gatewayPayment.id,
    'attempts.$[attempt].status': 'paid',
    'attempts.$[attempt].method': gatewayPayment.method,
  }
  await Payment.updateOne(
    { _id: payment._id, 'attempts.orderId': gatewayPayment.order_id },
    { $set: update, ...(webhookEventId ? { $addToSet: { processedWebhookEventIds: webhookEventId } } : {}) },
    { arrayFilters: [{ 'attempt.orderId': gatewayPayment.order_id }] },
  )
  return booking
}

export async function verifyPayment(request: Request, response: Response) {
  const { paymentId, razorpay_order_id: orderId, razorpay_payment_id: gatewayPaymentId, razorpay_signature: signature } = request.body || {}
  if (!isValidObjectId(paymentId) || !orderId || !gatewayPaymentId || !signature) {
    return response.status(400).json({ success: false, message: 'Payment confirmation details are required' })
  }

  try {
    const payment = await Payment.findOne({ _id: paymentId, customerId: request.user?.id })
    if (!payment) return response.status(404).json({ success: false, message: 'Payment not found' })
    if (payment.status === 'paid') {
      return response.json({ success: true, data: { payment: paymentResponse(payment), bookingId: String(payment.bookingId || '') } })
    }
    const knownOrder = payment.attempts.some((attempt) => attempt.orderId === String(orderId))
    if (!knownOrder) return response.status(400).json({ success: false, message: 'Payment order does not match this request' })

    const { keySecret } = getRazorpayCredentials()
    if (!verifyRazorpayPaymentSignature(String(orderId), String(gatewayPaymentId), String(signature), keySecret)) {
      return response.status(400).json({ success: false, message: 'Payment signature is invalid' })
    }
    const gatewayPayment = await getRazorpayClient().payments.fetch(String(gatewayPaymentId))
    const booking = await finalizeCapturedPayment(String(payment._id), gatewayPayment, `client:${gatewayPayment.id}`)
    const updated = await Payment.findById(payment._id)
    response.json({ success: true, data: { payment: paymentResponse(updated), bookingId: String(booking?._id || '') } })
  } catch {
    response.status(502).json({ success: false, message: 'Payment could not be confirmed yet. Refresh payment status before retrying.' })
  }
}

export async function reconcilePayment(paymentId: string) {
  const payment = await Payment.findById(paymentId)
  if (!payment || !['created', 'failed'].includes(payment.status)) return payment

  const gateway = getRazorpayClient()
  const attempts = [...payment.attempts].reverse()
  for (const attempt of attempts) {
    const result = await gateway.orders.fetchPayments(attempt.orderId)
    const captured = result.items.find((item) => item.status === 'captured' && item.captured)
    if (captured) {
      await finalizeCapturedPayment(String(payment._id), captured)
      return Payment.findById(payment._id)
    }
    if (attempt.orderId === payment.razorpayOrderId && result.items.length && result.items.every((item) => item.status === 'failed')) {
      await Payment.updateOne(
        { _id: payment._id, status: { $ne: 'paid' } },
        {
          $set: { status: 'failed', 'attempts.$[attempt].status': 'failed' },
        },
        { arrayFilters: [{ 'attempt.orderId': attempt.orderId }] },
      )
    }
  }
  return Payment.findById(payment._id)
}

export async function getPayment(request: Request, response: Response) {
  if (!isValidObjectId(request.params.paymentId)) return response.status(404).json({ success: false, message: 'Payment not found' })
  try {
    const payment = await Payment.findOne({ _id: request.params.paymentId, customerId: request.user?.id })
    if (!payment) return response.status(404).json({ success: false, message: 'Payment not found' })
    const current = await reconcilePayment(String(payment._id)).catch(() => payment)
    response.json({ success: true, data: paymentResponse(current) })
  } catch {
    response.status(502).json({ success: false, message: 'Unable to refresh payment status' })
  }
}

export async function getMyPayments(request: Request, response: Response) {
  try {
    const payments = await Payment.find({ customerId: request.user?.id }).sort({ createdAt: -1 }).limit(100)
    response.json({ success: true, data: payments.map(paymentResponse) })
  } catch {
    response.status(500).json({ success: false, message: 'Unable to load payment history' })
  }
}

export async function retryPayment(request: Request, response: Response) {
  if (!isValidObjectId(request.params.paymentId)) return response.status(404).json({ success: false, message: 'Payment not found' })
  try {
    const payment = await Payment.findOne({ _id: request.params.paymentId, customerId: request.user?.id })
    if (!payment) return response.status(404).json({ success: false, message: 'Payment not found' })
    if (!canRetryPayment(payment.status)) return response.status(409).json({ success: false, message: 'This payment cannot be retried' })

    const { keyId } = getRazorpayCredentials()
    if (payment.status === 'created' && payment.razorpayOrderId) {
      response.json({ success: true, data: checkoutResponse(payment, keyId) })
      return
    }

    const reset = await Payment.findOneAndUpdate(
      { _id: payment._id, customerId: request.user?.id, status: 'failed' },
      { $set: { status: 'pending' } },
      { new: true, includeResultMetadata: false },
    )
    if (!reset) return response.status(409).json({ success: false, message: 'Payment retry is already processing' })
    const retried = await createGatewayOrder(String(reset._id), ['pending'])
    response.json({ success: true, data: checkoutResponse(retried, keyId) })
  } catch {
    response.status(502).json({ success: false, message: 'Unable to retry payment. Please refresh the payment status.' })
  }
}

async function updateRefundStatus(paymentId: string, refundId: string, requestId: string | undefined, status: 'processed' | 'failed', webhookEventId?: string) {
  const refundMatch = requestId ? { 'refunds.requestId': requestId } : { 'refunds.razorpayRefundId': refundId }
  const arrayFilter = requestId ? { 'refund.requestId': requestId } : { 'refund.razorpayRefundId': refundId }
  const payment = await Payment.findOne({ _id: paymentId, ...refundMatch })
  if (!payment) return
  await Payment.updateOne(
    { _id: payment._id, ...refundMatch },
    {
      $set: { 'refunds.$[refund].razorpayRefundId': refundId, 'refunds.$[refund].status': status, 'refunds.$[refund].updatedAt': new Date() },
      $unset: { refundLock: 1, refundLockAt: 1 },
      ...(webhookEventId ? { $addToSet: { processedWebhookEventIds: webhookEventId } } : {}),
    },
    { arrayFilters: [arrayFilter] },
  )
  const updated = await Payment.findById(paymentId)
  if (!updated) return
  const processed = updated.refunds.filter((refund) => refund.status === 'processed').reduce((sum, refund) => sum + refund.amountPaise, 0)
  if (processed >= updated.amountPaise) {
    await Payment.updateOne({ _id: updated._id }, { $set: { status: 'refunded' } })
    if (updated.bookingId) await Booking.updateOne({ _id: updated.bookingId }, { $set: { paymentStatus: 'refunded' } })
  }
}

export async function applyRefundWebhook(refund: { id: string; payment_id: string; status: string; receipt?: string; notes?: Record<string, string> }, eventId?: string) {
  const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id })
  if (!payment) return
  if (eventId && payment.processedWebhookEventIds.includes(eventId)) return
  if (refund.status === 'processed' || refund.status === 'failed') {
    const requestId = refund.notes?.servicehubRefundRequestId || refund.receipt
    await updateRefundStatus(String(payment._id), refund.id, requestId, refund.status, eventId)
  }
}

export async function refundPayment(request: Request, response: Response) {
  if (!isValidObjectId(request.params.paymentId)) return response.status(404).json({ success: false, message: 'Payment not found' })
  const requestId = String(request.body?.requestId || '')
  const reason = String(request.body?.reason || '').trim()
  const amountPaise = request.body?.amountPaise === undefined ? undefined : Number(request.body.amountPaise)
  if (!requestId || requestId.length > 40 || !reason || reason.length > 500 || (amountPaise !== undefined && (!Number.isSafeInteger(amountPaise) || amountPaise < 1))) {
    return response.status(400).json({ success: false, message: 'A refund request ID, reason and valid amount are required' })
  }

  try {
    const payment = await Payment.findById(request.params.paymentId)
    if (!payment || payment.status !== 'paid' || !payment.razorpayPaymentId) {
      return response.status(409).json({ success: false, message: 'Only captured payments can be refunded' })
    }
    const existing = payment.refunds.find((refund) => refund.requestId === requestId)
    if (existing) return response.json({ success: true, data: { payment: paymentResponse(payment), refund: existing } })

    const gateway = getRazorpayClient()
    const capturedPayment = await gateway.payments.fetch(payment.razorpayPaymentId)
    if (capturedPayment.status !== 'captured' || capturedPayment.captured !== true || Number(capturedPayment.amount) !== payment.amountPaise || capturedPayment.currency !== payment.currency) {
      return response.status(409).json({ success: false, message: 'Razorpay does not confirm this payment as captured' })
    }

    const remaining = getRemainingRefundablePaise(payment.amountPaise, payment.refunds)
    const requestedAmount = amountPaise ?? remaining
    if (requestedAmount > remaining) return response.status(400).json({ success: false, message: 'Refund amount exceeds the remaining refundable balance' })

    const staleRefundLock = new Date(Date.now() - 2 * 60 * 1000)
    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'paid', $or: [{ refundLockAt: { $exists: false } }, { refundLockAt: { $lt: staleRefundLock } }] },
      {
        $set: { refundLock: requestId, refundLockAt: new Date() },
        $push: { refunds: { requestId, amountPaise: requestedAmount, reason, status: 'created', createdAt: new Date(), updatedAt: new Date() } },
      },
      { new: true, includeResultMetadata: false },
    )
    if (!claimed) return response.status(409).json({ success: false, message: 'Another refund request is being processed for this payment' })

    try {
      const gatewayRefund = await gateway.payments.refund(payment.razorpayPaymentId, {
        amount: requestedAmount,
        receipt: requestId,
        notes: { servicehubPaymentId: String(payment._id), servicehubRefundRequestId: requestId, reason },
      })
      const refundStatus = gatewayRefund.status === 'processed' ? 'processed' : gatewayRefund.status === 'failed' ? 'failed' : 'created'
      await Payment.updateOne(
        { _id: payment._id, 'refunds.requestId': requestId },
        {
          $set: { 'refunds.$.razorpayRefundId': gatewayRefund.id, 'refunds.$.status': refundStatus, 'refunds.$.updatedAt': new Date() },
          $unset: { refundLock: 1, refundLockAt: 1 },
        },
      )
      if (refundStatus === 'processed') await updateRefundStatus(String(payment._id), gatewayRefund.id, requestId, 'processed')
      const updated = await Payment.findById(payment._id)
      response.status(201).json({ success: true, data: { payment: paymentResponse(updated), refund: updated?.refunds.find((refund) => refund.requestId === requestId) } })
    } catch {
      await Payment.updateOne(
        { _id: payment._id, 'refunds.requestId': requestId },
        { $set: { 'refunds.$.status': 'failed', 'refunds.$.updatedAt': new Date() }, $unset: { refundLock: 1, refundLockAt: 1 } },
      )
      response.status(502).json({ success: false, message: 'Razorpay could not create the refund. Check payment status before retrying.' })
    }
  } catch {
    response.status(502).json({ success: false, message: 'Unable to process the refund request' })
  }
}

export async function markPaymentFailed(payment: any, orderId: string, eventId?: string) {
  await Payment.updateOne(
    { _id: payment._id, status: { $nin: ['paid', 'refunded'] }, 'attempts.orderId': orderId },
    {
      $set: { status: payment.razorpayOrderId === orderId ? 'failed' : payment.status, 'attempts.$.status': 'failed' },
      ...(eventId ? { $addToSet: { processedWebhookEventIds: eventId } } : {}),
    },
  )
}

export async function handleCapturedWebhook(paymentEntity: GatewayPayment, eventId: string) {
  const payment = await Payment.findOne({ $or: [{ razorpayOrderId: paymentEntity.order_id }, { 'attempts.orderId': paymentEntity.order_id }] })
  if (!payment) return
  if (eventId && payment.processedWebhookEventIds.includes(eventId)) return
  await finalizeCapturedPayment(String(payment._id), paymentEntity, eventId)
}

export async function getPaymentsForAdmin(_request: Request, response: Response) {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }).limit(200)
    response.json({ success: true, data: payments.map(paymentResponse) })
  } catch {
    response.status(500).json({ success: false, message: 'Unable to load payment records' })
  }
}