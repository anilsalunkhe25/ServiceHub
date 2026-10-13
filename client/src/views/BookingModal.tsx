import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createPaymentOrder, verifyPayment, type PaymentMethod, type Provider as ApiProvider } from '../api'
import { useAuth } from '../context/AuthContext'
import { createBookingRequest, getErrorMessage } from '../controllers/providerController'
import { PaymentSummary, PayNowButton } from '../features/booking/components/PaymentComponents'
import { launchRazorpayCheckout } from '../features/booking/services/paymentCheckout'
import { bookingTimes, getLocalDate, isPastBookingTime } from '../features/provider/schedule'

export function BookingModal({ provider, onClose, urgent = false, initialDate = '', initialTime = '' }: { provider: ApiProvider; onClose: () => void; urgent?: boolean; initialDate?: string; initialTime?: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery')
  const [isPaying, setIsPaying] = useState(false)
  const [paymentSummary, setPaymentSummary] = useState<Parameters<typeof PaymentSummary>[0]['summary'] | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [bookingDate, setBookingDate] = useState(initialDate)
  const [bookingTime, setBookingTime] = useState(() => isPastBookingTime(initialDate, initialTime, new Date()) ? '' : initialTime)
  const [selectedPackageId, setSelectedPackageId] = useState(provider.packages?.[0]?.id || '')
  const selectedPackage = provider.packages?.find((item) => item.id === selectedPackageId)
  const amount = selectedPackage
    ? selectedPackage.pricePaise / 100
    : Number((provider.pricing || '').match(/\d[\d,]*(?:\.\d{1,2})?/)?.[0]?.replace(/,/g, '')) || 0

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !localStorage.getItem('servicehub_token')) {
      onClose()
      navigate('/login')
      return
    }

    if (user.role !== 'customer') {
      setStatus('Only customer accounts can book services. Switch to a customer account to continue.')
      return
    }

    if (isPastBookingTime(bookingDate, bookingTime, new Date())) {
      setStatus('Please choose a future date and time.')
      return
    }

    const form = new FormData(event.currentTarget)
    const booking = {
      providerId: provider._id || '',
      packageId: selectedPackage?.id,
      service: provider.category,
      date: String(form.get('date')),
      time: String(form.get('time')),
      address: String(form.get('address')),
      description: String(form.get('description')),
      urgent,
    }
    setStatus('loading')

    try {
      if (paymentMethod === 'upi') {
        const fingerprint = JSON.stringify({ customerId: user.id, ...booking })
        const savedRequest = JSON.parse(sessionStorage.getItem('servicehub_payment_request') || 'null') as { fingerprint: string; key: string } | null
        const idempotencyKey = savedRequest?.fingerprint === fingerprint ? savedRequest.key : crypto.randomUUID()
        sessionStorage.setItem('servicehub_payment_request', JSON.stringify({ fingerprint, key: idempotencyKey }))
        const order = await createPaymentOrder(booking, idempotencyKey)
        setPaymentSummary(order.summary)
        setIsPaying(true)
        try {
          const paymentResult = await launchRazorpayCheckout(order.checkout, user)
          await verifyPayment(order.payment._id, paymentResult)
          sessionStorage.removeItem('servicehub_payment_request')
          onClose()
          navigate(`/payment/status/${order.payment._id}`)
        } catch (reason) {
          onClose()
          navigate(`/payment/status/${order.payment._id}`, {
            state: { checkoutClosed: reason instanceof Error && reason.message === 'checkout_cancelled' },
          })
        }
        return
      }

      await createBookingRequest({ ...booking, amount, paymentMethod: 'cash_on_delivery' })

      setStatus('Booking requested. You can track it in your dashboard.')
      setTimeout(onClose, 1800)
    } catch (reason) {
      setStatus(getErrorMessage(reason))
      setIsPaying(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X />
        </button>

        <p className="kicker">Book a local pro</p>
        <h2>{provider.businessName}</h2>
        <p className="modal-muted">{provider.category} · {provider.city}</p>
        {urgent && <p className="emergency-booking-note">Emergency request · the provider will be notified of the urgency.</p>}

        {!user && <p className="auth-hint">You will be asked to log in before your request is submitted.</p>}
        {user && user.role !== 'customer' && (
          <div className="booking-role-warning">
            <p>Bookings must be placed from a customer account.</p>
            <button type="button" className="dark-button" onClick={() => { logout(); onClose(); navigate('/login') }}>
              <LogOut size={15} /> Switch account
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {provider.packages?.length ? <fieldset className="booking-package-choice">
            <legend>Choose a service package</legend>
            {provider.packages.map((servicePackage) => <label className={`booking-package-option ${selectedPackageId === servicePackage.id ? 'is-selected' : ''}`} key={servicePackage.id}>
              <input type="radio" name="servicePackage" value={servicePackage.id} checked={selectedPackageId === servicePackage.id} onChange={() => setSelectedPackageId(servicePackage.id)} required />
              <span className="booking-package-copy"><strong>{servicePackage.name}</strong><b>₹{(servicePackage.pricePaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
                <small>{servicePackage.features.join(' · ')}</small></span>
            </label>)}
          </fieldset> : null}

          <label>
            Date
            <input name="date" type="date" min={getLocalDate(now)} value={bookingDate} onChange={(event) => {
              const date = event.target.value
              setBookingDate(date)
              if (isPastBookingTime(date, bookingTime, new Date())) setBookingTime('')
            }} required />
          </label>

          <label>
            Time
            <select name="time" value={bookingTime} onChange={(event) => setBookingTime(event.target.value)} required>
              <option value="">Choose a time</option>
              {bookingTimes.map((time) => <option key={time} disabled={isPastBookingTime(bookingDate, time, now)}>{time}</option>)}
            </select>
          </label>

          <label>
            Address
            <input name="address" placeholder="Service address" required />
          </label>

          <label>
            Payment method
            <select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} required>
              <option value="cash_on_delivery">Cash on delivery</option>
              <option value="upi" disabled={amount < 1}>Pay online with UPI, cards, net banking or wallet</option>
            </select>
          </label>

          {paymentMethod === 'upi' && <>
            <p className="modal-muted">Secure payment through Razorpay. Available methods depend on your account configuration.</p>
            <PaymentSummary summary={paymentSummary || {
              service: provider.category,
              provider: provider.businessName,
              packageName: selectedPackage?.name,
              basePricePaise: amount * 100,
              taxPaise: 0,
              feePaise: 0,
              totalPaise: amount * 100,
            }} />
          </>}

          <label>
            What do you need help with?
            <textarea name="description" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add a short description" required />
          </label>

          {paymentMethod === 'upi' && user
            ? <PayNowButton loading={status === 'loading' || isPaying}>{isPaying ? 'Opening secure checkout...' : 'Pay now'}</PayNowButton>
            : <button className="modal-submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending request...' : user ? 'Request booking' : 'Continue to login'}
              <ArrowRight size={16} />
            </button>}
        </form>

        {status && status !== 'loading' && <p className="form-status">{status}</p>}
      </div>
    </div>
  )
}
