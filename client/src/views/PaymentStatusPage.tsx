import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getPayment, retryPayment, verifyPayment, type PaymentCheckout, type PaymentTransaction } from '../api'
import { useAuth } from '../context/AuthContext'
import { PaymentStatus, PaymentSummary, PayNowButton } from '../features/booking/components/PaymentComponents'
import { launchRazorpayCheckout } from '../features/booking/services/paymentCheckout'
import { Navigation } from '../components/Navigation'

export function PaymentStatusPage() {
  const { paymentId = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const [payment, setPayment] = useState<PaymentTransaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const checkoutClosed = (location.state as { checkoutClosed?: boolean } | null)?.checkoutClosed

  const refreshPayment = useCallback(async () => {
    if (!paymentId) return
    try {
      const currentPayment = await getPayment(paymentId)
      setPayment(currentPayment)
      setError('')
    } catch {
      setError('Unable to refresh payment. Sign in with the customer account used to book.')
    } finally {
      setLoading(false)
    }
  }, [paymentId])

  useEffect(() => {
    let active = true
    getPayment(paymentId)
      .then((currentPayment) => {
        if (!active) return
        setPayment(currentPayment)
        setError('')
      })
      .catch(() => {
        if (active) setError('Unable to refresh payment. Sign in with the customer account used to book.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [paymentId])

  const handleRetry = async () => {
    if (!payment || !user) return
    setProcessing(true)
    setError('')
    try {
      const checkout: PaymentCheckout = await retryPayment(payment._id)
      const result = await launchRazorpayCheckout(checkout.checkout, user)
      await verifyPayment(payment._id, result)
      setNotice('Checkout completed. Confirming the payment with Razorpay...')
      await refreshPayment()
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'checkout_cancelled') {
        setNotice('Checkout closed. Your payment status has been refreshed.')
        await refreshPayment()
      } else {
        setError('We could not confirm the payment yet. Refresh the status before trying again.')
        await refreshPayment()
      }
    } finally {
      setProcessing(false)
    }
  }

  const summary = payment ? {
    service: payment.bookingDetails.service,
    provider: payment.bookingDetails.providerBusinessName,
    packageName: payment.bookingDetails.packageName,
    basePricePaise: payment.amountPaise - payment.taxPaise - payment.feePaise,
    taxPaise: payment.taxPaise,
    feePaise: payment.feePaise,
    totalPaise: payment.amountPaise,
  } : null

  return (
    <>
      <Navigation />
      <main className="payment-page container">
        <Link className="text-link" to="/payments"><ArrowLeft size={15} /> Payment history</Link>
        <p className="kicker">Payment status</p>
        <h1>{loading ? 'Checking payment...' : payment ? <PaymentStatus status={payment.status} /> : 'Payment unavailable'}</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        {(notice || (checkoutClosed ? 'Checkout closed. The payment status below is refreshed from the server.' : '')) && <p className="form-status" role="status">{notice || 'Checkout closed. The payment status below is refreshed from the server.'}</p>}
        {payment && <>
          {summary && <PaymentSummary summary={summary} />}
          <dl className="payment-details">
            <div><dt>Payment reference</dt><dd>{payment._id}</dd></div>
            {payment.razorpayPaymentId && <div><dt>Gateway transaction</dt><dd>{payment.razorpayPaymentId}</dd></div>}
            {payment.bookingId && <div><dt>Booking ID</dt><dd>{payment.bookingId}</dd></div>}
            <div><dt>Method</dt><dd>{payment.paymentMethod || 'Razorpay Checkout'}</dd></div>
          </dl>
          {payment.bookingId && <p>Your booking request is confirmed and visible in your dashboard.</p>}
          {!payment.bookingId && payment.status === 'created' && <p>Your payment is awaiting confirmation. Refresh to check the latest status.</p>}
          {!payment.bookingId && payment.status === 'pending' && <p>Your payment order is being prepared. Refresh this page shortly.</p>}
          {payment.status === 'failed' && <p>The payment was not completed. You can retry securely without creating a duplicate booking.</p>}
          {payment.status === 'refunded' && <p>The full payment has been refunded. Refund updates appear in payment history.</p>}
          <div className="payment-page-actions">
            {['created', 'failed'].includes(payment.status) && !payment.bookingId && (
              <form onSubmit={(event) => { event.preventDefault(); void handleRetry() }}>
                <PayNowButton loading={processing}>{processing ? 'Opening secure checkout...' : 'Retry payment'}</PayNowButton>
              </form>
            )}
            <button className="dashboard-refresh" type="button" onClick={() => void refreshPayment()} disabled={loading || processing}>
              <RefreshCw size={15} /> Refresh status
            </button>
            <Link className="text-link" to="/dashboard">View bookings</Link>
          </div>
        </>}
      </main>
    </>
  )
}