import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { getAdminPayments, requestPaymentRefund, type PaymentTransaction } from '../api'
import { Navigation } from '../components/Navigation'
import { useAuth } from '../context/AuthContext'
import { PaymentStatus } from '../features/booking/components/PaymentComponents'

export function AdminPaymentsPage() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  const loadPayments = () => getAdminPayments().then(setPayments).catch(() => setError('Unable to load payment records.'))

  useEffect(() => {
    if (user?.role === 'admin') void loadPayments()
  }, [user])

  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />

  const submitRefund = async (event: FormEvent<HTMLFormElement>, payment: PaymentTransaction) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const reason = String(form.get('reason') || '').trim()
    const amountText = String(form.get('amount') || '').trim()
    const amountPaise = amountText ? Math.round(Number(amountText) * 100) : undefined
    setProcessing(payment._id)
    setError('')
    setNotice('')
    try {
      const result = await requestPaymentRefund(payment._id, crypto.randomUUID(), reason, amountPaise)
      setPayments((current) => current.map((item) => item._id === payment._id ? result.data.payment : item))
      setNotice(`Refund request submitted. Gateway status: ${result.data.refund.status}.`)
      formElement.reset()
    } catch {
      setError('Refund could not be created. Refresh payment status before trying again.')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <>
      <Navigation />
      <main className="payment-page container admin-payment-page">
        <p className="kicker">Administration</p>
        <h1>Payment records</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-status" role="status">{notice}</p>}
        {payments.map((payment) => {
          const refundablePaise = payment.amountPaise - payment.refunds
            .filter((refund) => refund.status !== 'failed')
            .reduce((sum, refund) => sum + refund.amountPaise, 0)
          return (
            <article className="admin-payment-row" key={payment._id}>
              <div className="admin-payment-heading">
                <div><strong>{payment.bookingDetails.packageName || payment.bookingDetails.service}</strong><p>{payment.bookingDetails.providerBusinessName} · {payment._id}</p></div>
                <PaymentStatus status={payment.status} />
              </div>
              <p>₹{(payment.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · Customer {String(payment.customerId || 'unavailable')}</p>
              {payment.razorpayPaymentId && <p>Razorpay payment: {payment.razorpayPaymentId}</p>}
              {payment.refunds.map((refund) => <p key={refund.requestId}>Refund ₹{(refund.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} · {refund.status} · {refund.reason}</p>)}
              {payment.status === 'paid' && refundablePaise > 0 && <form className="admin-refund-form" onSubmit={(event) => void submitRefund(event, payment)}>
                <label>Partial amount in ₹ (leave blank for full remaining refund)<input name="amount" type="number" min="0.01" max={(refundablePaise / 100).toFixed(2)} step="0.01" /></label>
                <label>Refund reason<input name="reason" maxLength={500} required /></label>
                <button className="dashboard-refresh" type="submit" disabled={processing === payment._id}>{processing === payment._id ? 'Submitting...' : 'Initiate refund'}</button>
              </form>}
            </article>
          )
        })}
        {!payments.length && <p>No payment records found.</p>}
      </main>
    </>
  )
}