import { CreditCard, LoaderCircle } from 'lucide-react'
import type { PaymentCheckout, PaymentStatus as PaymentState } from '../../../api'

export function PaymentSummary({ summary }: { summary: PaymentCheckout['summary'] }) {
  const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <section className="payment-summary" aria-label="Payment summary">
      <div><span>Service</span><strong>{summary.service}</strong></div>
      <div><span>Provider</span><strong>{summary.provider}</strong></div>
      {summary.packageName && <div><span>Package</span><strong>{summary.packageName}</strong></div>}
      <div><span>Base price</span><strong>{money(summary.basePricePaise)}</strong></div>
      <div><span>Taxes</span><strong>{money(summary.taxPaise)}</strong></div>
      <div><span>Fees</span><strong>{money(summary.feePaise)}</strong></div>
      <div className="payment-summary-total"><span>Total</span><strong>{money(summary.totalPaise)}</strong></div>
    </section>
  )
}

export function PayNowButton({ loading, children = 'Pay now' }: { loading: boolean; children?: string }) {
  return (
    <button className="modal-submit" type="submit" disabled={loading}>
      {loading ? <LoaderCircle size={16} className="payment-spinner" /> : <CreditCard size={16} />}
      {children}
    </button>
  )
}

export function PaymentStatus({ status }: { status: PaymentState }) {
  const labels: Record<PaymentState, string> = {
    pending: 'Preparing payment',
    created: 'Payment pending',
    paid: 'Paid',
    failed: 'Payment failed',
    refunded: 'Refunded',
  }
  return <span className={`payment-state payment-state-${status}`}>{labels[status]}</span>
}