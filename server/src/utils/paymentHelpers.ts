import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { ServicePackage } from '../config/appState.js'

export type RefundEntry = { amountPaise: number; status: 'created' | 'processed' | 'failed' }

export function normalizeServicePackages(value: unknown): ServicePackage[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 12) return null

  const ids = new Set<string>()
  const packages: ServicePackage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const candidate = item as Record<string, unknown>
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
    const pricePaise = Number(candidate.pricePaise)
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id) || !name || name.length > 60 || !Number.isSafeInteger(pricePaise) || pricePaise < 1 || pricePaise > 100_000_000_00) return null
    if (!Array.isArray(candidate.features) || candidate.features.length < 1 || candidate.features.length > 10 || candidate.features.some((feature) => typeof feature !== 'string' || !feature.trim() || feature.trim().length > 120)) return null
    ids.add(id)
    packages.push({ id, name, features: candidate.features.map((feature: string) => feature.trim()), pricePaise })
  }
  return packages
}

function validHexSignature(expected: Buffer, signature: string) {
  if (!/^[a-f\d]+$/i.test(signature) || signature.length !== expected.length * 2) return false
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function getBasePricePaise(pricing: string | null | undefined) {
  const match = pricing?.match(/\d[\d,]*(?:\.\d{1,2})?/)
  if (!match) return null
  const rupees = Number(match[0].replace(/,/g, ''))
  const paise = Math.round(rupees * 100)
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null
}

export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest()
  return validHexSignature(expected, signature)
}

export function verifyRazorpayWebhookSignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(rawBody).digest()
  return validHexSignature(expected, signature)
}

export function canRetryPayment(status: string) {
  return status === 'created' || status === 'failed'
}

export function getRemainingRefundablePaise(amountPaise: number, refunds: RefundEntry[]) {
  const reserved = refunds
    .filter((refund) => refund.status !== 'failed')
    .reduce((total, refund) => total + refund.amountPaise, 0)
  return Math.max(0, amountPaise - reserved)
}

export function getBookingIntentKey(customerId: string, providerId: string, date: string, time: string, packageId = '') {
  return createHash('sha256').update(`${customerId}|${providerId}|${date}|${time}|${packageId}`).digest('hex')
}