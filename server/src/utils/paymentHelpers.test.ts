import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import test from 'node:test'
import {
  canRetryPayment,
  formatStartingPrice,
  getBasePricePaise,
  getBookingIntentKey,
  getRemainingRefundablePaise,
  normalizeServicePackages,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './paymentHelpers.js'

test('adds the rupee symbol to service prices without duplicating existing currency', () => {
  assert.equal(formatStartingPrice('From 300'), 'From ₹300')
  assert.equal(formatStartingPrice('300'), '₹300')
  assert.equal(formatStartingPrice('From ₹300'), 'From ₹300')
  assert.equal(formatStartingPrice('Rs. 300'), 'Rs. 300')
  assert.equal(formatStartingPrice('Price on request'), 'Price on request')
})

test('parses the first listed provider price into paise', () => {
  assert.equal(getBasePricePaise('From ₹1,499'), 149900)
  assert.equal(getBasePricePaise('₹499.50 - ₹999'), 49950)
  assert.equal(getBasePricePaise('Price on request'), null)
})

test('verifies payment signatures and rejects tampered values', () => {
  const secret = 'test-secret'
  const orderId = 'order_test'
  const paymentId = 'pay_test'
  const signature = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret), true)
  assert.equal(verifyRazorpayPaymentSignature(orderId, 'pay_tampered', signature, secret), false)
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, 'invalid', secret), false)
})

test('verifies webhook signatures against the exact raw body', () => {
  const secret = 'webhook-secret'
  const rawBody = Buffer.from('{"event":"payment.captured"}')
  const signature = createHmac('sha256', secret).update(rawBody).digest('hex')

  assert.equal(verifyRazorpayWebhookSignature(rawBody, signature, secret), true)
  assert.equal(verifyRazorpayWebhookSignature(randomBytes(rawBody.length), signature, secret), false)
})

test('permits retry only for unpaid states and reserves pending refunds', () => {
  assert.equal(canRetryPayment('created'), true)
  assert.equal(canRetryPayment('failed'), true)
  assert.equal(canRetryPayment('paid'), false)
  assert.equal(getRemainingRefundablePaise(10000, [
    { amountPaise: 2500, status: 'processed' },
    { amountPaise: 1500, status: 'created' },
    { amountPaise: 800, status: 'failed' },
  ]), 6000)
})

test('creates a stable key for duplicate customer booking intents', () => {
  const first = getBookingIntentKey('customer-1', 'provider-1', '2026-12-01', '09:00 AM')
  assert.equal(first, getBookingIntentKey('customer-1', 'provider-1', '2026-12-01', '09:00 AM'))
  assert.notEqual(first, getBookingIntentKey('customer-2', 'provider-1', '2026-12-01', '09:00 AM'))
  assert.notEqual(first, getBookingIntentKey('customer-1', 'provider-1', '2026-12-01', '12:00 PM'))
  assert.notEqual(first, getBookingIntentKey('customer-1', 'provider-1', '2026-12-01', '09:00 AM', 'premium'))
})

test('normalizes valid packages and rejects malformed package prices or features', () => {
  assert.deepEqual(normalizeServicePackages([{ id: 'basic-1', name: ' Basic ', features: [' Switch replacement '], pricePaise: 29900 }]), [
    { id: 'basic-1', name: 'Basic', features: ['Switch replacement'], pricePaise: 29900 },
  ])
  assert.equal(normalizeServicePackages([{ id: 'basic-1', name: 'Basic', features: ['Inspection'], pricePaise: 0 }]), null)
  assert.equal(normalizeServicePackages([{ id: 'basic-1', name: 'Basic', features: ['  '], pricePaise: 29900 }]), null)
  assert.equal(normalizeServicePackages([{ id: 'basic-1', name: 'Basic', features: ['Inspection'], pricePaise: 29900 }, { id: 'basic-1', name: 'Plus', features: ['Repair'], pricePaise: 50000 }]), null)
})