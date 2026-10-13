import { useEffect, useState } from 'react'
import { ArrowRight, ReceiptText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMyPayments, type PaymentTransaction } from '../api'
import { Navigation } from '../components/Navigation'
import { PaymentStatus } from '../features/booking/components/PaymentComponents'

export function MyPaymentsPage() {
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyPayments().then(setPayments).catch(() => setError('Unable to load payment history. Please sign in as a customer.')).finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Navigation />
      <main className="payment-page container">
        <p className="kicker">Your account</p>
        <h1>Payment history</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <p>Loading payment history...</p> : payments.length ? <div className="payment-history-list">
          {payments.map((payment) => (
            <Link className="payment-history-row" key={payment._id} to={`/payment/status/${payment._id}`}>
              <ReceiptText size={19} />
              <span><strong>{payment.bookingDetails.packageName || payment.bookingDetails.service}</strong><small>{payment.bookingDetails.providerBusinessName} · {new Date(payment.createdAt).toLocaleDateString('en-IN')}</small></span>
              <strong>₹{(payment.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              <PaymentStatus status={payment.status} />
              <ArrowRight size={16} />
            </Link>
          ))}
        </div> : !error && <div className="empty-state"><ReceiptText size={28} /><h2>No online payments</h2><p>Your Razorpay payments will appear here.</p><Link className="text-link" to="/services">Browse services <ArrowRight size={15} /></Link></div>}
      </main>
    </>
  )
}