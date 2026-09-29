import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, LoaderCircle, LogOut, Star, XCircle } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import type { Booking } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  changeBookingStatus,
  getErrorMessage,
  loadCustomerDetails,
  loadMyBookings,
  loadProviderBookings,
  removeService,
  sendReview,
  fetchMyService,
  persistService,
} from '../controllers/providerController'

function ProviderServiceForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    businessName: '',
    category: '',
    description: '',
    city: '',
    address: '',
    pricing: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMyService().then((service) => {
      if (service) {
        setForm({
          businessName: service.businessName || '',
          category: service.category || '',
          description: service.description || '',
          city: service.city || '',
          address: service.address || '',
          pricing: service.pricing || '',
        })
        localStorage.setItem('servicehub_my_service', JSON.stringify(service))
      }
    }).catch(() => {
      const saved = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null')
      if (saved) setForm(saved)
      else setStatus('Unable to load your service listing.')
    }).finally(() => setLoading(false))
  }, [])

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(isEditing ? 'Updating...' : 'Saving...')

    try {
      const service = await persistService(form, isEditing)
      localStorage.setItem('servicehub_my_service', JSON.stringify(service))
      setStatus(isEditing ? 'Your service has been updated.' : 'Your service is live in the customer marketplace.')

      if (!isEditing) {
        setTimeout(() => navigate(`/services?search=${encodeURIComponent(form.category)}`), 900)
      } else {
        setIsEditing(false)
        setTimeout(() => setStatus(''), 2000)
      }
    } catch (reason) {
      setStatus(getErrorMessage(reason))
    }
  }

  const deleteService = async () => {
    if (!window.confirm('Are you sure you want to delete your service listing? This cannot be undone.')) return
    setStatus('Deleting...')

    try {
      await removeService()
      setForm({ businessName: '', category: '', description: '', city: '', address: '', pricing: '' })
      setIsEditing(false)
      setStatus('Your service has been deleted.')
      setTimeout(() => setStatus(''), 2000)
    } catch (reason) {
      setStatus(getErrorMessage(reason))
    }
  }

  return (
    <section className="container service-editor">
      <div>
        <p className="kicker">Your public listing</p>
        <h2>Create <span>your service.</span></h2>
        <p>Tell customers what you offer. You can update this listing anytime.</p>
      </div>

      {loading ? <LoaderCircle className="loader" /> : (
        <form onSubmit={submit}>
          <div className="editor-fields">
            <label>
              Business name
              <input value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} placeholder="Enter your business name" required />
            </label>
            <label>
              Service type
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)} required>
                <option value="">Select a service type</option>
                {['Home repair', 'Cleaning', 'Auto care', 'Wellness', 'Tutoring', 'Moving', 'Electrician', 'Photographer', 'Saloon', 'Grocery', 'Electrical services'].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              City
              <input value={form.city} onChange={(event) => updateField('city', event.target.value)} placeholder="Pune" required />
            </label>
            <label>
              Starting price
              <input value={form.pricing} onChange={(event) => updateField('pricing', event.target.value)} placeholder="From ₹499" />
            </label>
            <label className="editor-wide">
              Address
              <input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Service area or business address" />
            </label>
            <label className="editor-wide">
              Description
              <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Describe the service you provide" rows={3} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="submit" className="auth-submit">
              {form.businessName ? (isEditing ? 'Update service' : 'Save service listing') : 'Publish service'}
              <ArrowRight size={16} />
            </button>

            {form.businessName && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isEditing && <button type="button" className="dark-button" onClick={() => setIsEditing(true)}>Edit</button>}
                <button type="button" className="reject-button" onClick={deleteService}>Delete</button>
              </div>
            )}
          </div>

          {status && <p className={status.startsWith('Unable') || status.includes('required') || status.includes('Authentication') ? 'form-error' : 'form-status'}>{status}</p>}
        </form>
      )}
    </section>
  )
}

function ProviderBookingRow({ booking, onStatusChange }: { booking: Booking; onStatusChange: (booking: Booking, status: Booking['bookingStatus']) => void }) {
  const [customer, setCustomer] = useState<{ name: string; phone?: string } | null>(null)

  useEffect(() => {
    loadCustomerDetails(booking._id).then(setCustomer).catch(() => setCustomer(null))
  }, [booking._id])

  const nextAction: Record<Booking['bookingStatus'], { label: string; status: Booking['bookingStatus'] } | null> = {
    pending: { label: 'Accept', status: 'accepted' },
    accepted: { label: 'Mark on the way', status: 'on_the_way' },
    rejected: null,
    on_the_way: { label: 'Start service', status: 'in_progress' },
    in_progress: { label: 'Complete', status: 'completed' },
    completed: null,
  }

  const action = nextAction[booking.bookingStatus]

  return (
    <article className="provider-booking-row">
      <div className="booking-row-main">
        <CalendarDays size={20} />
        <div>
          <strong>{booking.service}</strong>
          <p>{booking.date} · {booking.time} · {booking.address}</p>
          {customer && <p style={{ fontSize: '14px', color: '#666' }}>📞 {customer.phone || 'Phone not provided'}</p>}
          <small>{booking.description || 'No additional details provided.'}</small>
        </div>
        <span className={`status status-${booking.bookingStatus}`}>{booking.bookingStatus.replace('_', ' ')}</span>
      </div>

      {booking.bookingStatus === 'pending' ? (
        <div className="booking-actions">
          <button className="reject-button" onClick={() => onStatusChange(booking, 'rejected')}><XCircle size={15} /> Reject</button>
          {action && <button className="accept-button" onClick={() => onStatusChange(booking, action.status)}><Check size={15} /> {action.label}</button>}
        </div>
      ) : action ? (
        <div className="booking-actions">
          <button className="accept-button" onClick={() => onStatusChange(booking, action.status)}><Check size={15} /> {action.label}</button>
        </div>
      ) : null}
    </article>
  )
}

function RatingModal({ booking, onClose, onSubmit }: { booking: Booking; onClose: () => void; onSubmit: (rating: number, comment: string) => Promise<void> }) {
  const [rating, setRating] = useState(booking.review?.rating || 0)
  const [comment, setComment] = useState(booking.review?.comment || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!rating || rating < 1) {
      setMessage('Please select a rating')
      return
    }

    setLoading(true)

    try {
      await onSubmit(rating, comment)
      setMessage('Thank you for your review!')
      setTimeout(onClose, 1500)
    } catch {
      setMessage('Could not submit your review. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><XCircle size={18} /></button>
        <p className="kicker">Rate your experience</p>
        <h2>{booking.service}</h2>
        <p className="modal-muted">How was your experience with this service?</p>
        <form onSubmit={handleSubmit}>
          <div className="rating-input">
            <label>
              Your Rating
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" className="star" onClick={() => setRating(star)} style={{ cursor: 'pointer' }}>
                    <Star size={20} fill={star <= rating ? 'currentColor' : 'none'} className={star <= rating ? 'filled' : ''} />
                  </button>
                ))}
              </div>
            </label>

            <label>
              Comments (optional)
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share your experience..." />
            </label>

            {message && <p className={`form-${message.includes('Thank') ? 'status' : 'error'}`}>{message}</p>}
            <button type="submit" className="modal-submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Review'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProviderDashboard() {
  const { user, logout } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    loadProviderBookings().then(setBookings).catch(() => setError('Unable to load booking requests.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const changeStatus = async (booking: Booking, status: Booking['bookingStatus']) => {
    try {
      const updated = await changeBookingStatus(booking, status)
      setBookings((items) => items.map((item) => item._id === updated._id ? updated : item))
    } catch {
      setError('That booking could not be updated. Please refresh and try again.')
    }
  }

  const pendingCount = bookings.filter((booking) => booking.bookingStatus === 'pending').length
  const todayCount = bookings.filter((booking) => booking.date === new Date().toISOString().slice(0, 10)).length
  const earnings = bookings.filter((booking) => booking.bookingStatus === 'completed').reduce((total, booking) => total + (booking.amount || 0), 0)

  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <Navigation />
      <main className="dashboard-page">
        <div className="container dashboard-header">
          <div>
            <p className="kicker">Provider dashboard</p>
            <h1>Good morning, <em>{user.name.split(' ')[0]}.</em></h1>
            <p>Review requests, keep customers updated, and manage today's work.</p>
          </div>
          <button className="dashboard-logout" onClick={logout}><LogOut size={16} /> Log out</button>
        </div>

        <ProviderServiceForm />

        <div className="provider-alert">
          <Clock3 size={20} />
          <strong>{pendingCount} New Booking {pendingCount === 1 ? 'Request' : 'Requests'}</strong>
          <span>Waiting for your response</span>
        </div>

        <div className="container dashboard-grid">
          <div className="dash-stat"><span>Today's bookings</span><strong>{todayCount}</strong><small>Scheduled for today</small></div>
          <div className="dash-stat"><span>Earnings</span><strong>₹{earnings.toLocaleString('en-IN')}</strong><small>Completed bookings</small></div>
          <div className="dash-stat"><span>Open requests</span><strong>{pendingCount}</strong><small>Need your attention</small></div>
        </div>

        <div className="container booking-list">
          <div className="section-heading">
            <div><p className="kicker">Incoming work</p><h2>Booking <span>requests.</span></h2></div>
            <button className="dashboard-refresh" onClick={load}>Refresh</button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading ? <LoaderCircle className="loader" /> : bookings.length ? bookings.map((booking) => <ProviderBookingRow booking={booking} onStatusChange={changeStatus} key={booking._id} />) : <div className="empty-state"><CalendarDays size={28} /><h3>No booking requests</h3><p>New customer requests will appear here.</p></div>}
        </div>
      </main>
    </>
  )
}

function CustomerDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (user) {
      loadMyBookings().then(setBookings).catch(() => setBookings([]))
    }
  }, [user])

  const handleRatingSubmit = async (rating: number, comment: string) => {
    if (!ratingBooking) return
    const updated = await sendReview(ratingBooking._id, rating, comment)
    setBookings((items) => items.map((item) => item._id === updated._id ? updated : item))
    setRatingBooking(null)
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <Navigation />
      <main className="dashboard-page">
        <div className="container dashboard-header">
          <div>
            <p className="kicker">Your Service Hub</p>
            <h1>Hello, <em>{user.name.split(' ')[0]}.</em></h1>
            <p>Keep your bookings and local favourites in one place.</p>
          </div>
        </div>

        <div className="container dashboard-grid">
          <div className="dash-stat"><span>Bookings</span><strong>{bookings.length}</strong><small>All your requests</small></div>
          <div className="dash-stat"><span>City</span><strong>{user.city || 'Not set'}</strong><small>Your current location</small></div>
          <div className="dash-stat"><span>Account</span><strong>{user.role}</strong><small>Verified session</small></div>
        </div>

        <div className="container booking-list">
          <div className="section-heading">
            <div><p className="kicker">Activity</p><h2>Your <span>bookings.</span></h2></div>
            <Link to="/services" className="dark-button">Book another service <ArrowRight size={16} /></Link>
          </div>

          {bookings.length ? bookings.map((booking) => (
            <div className="booking-row" key={booking._id}>
              <CalendarDays size={20} />
              <div>
                <strong>{booking.service}</strong>
                <p>{booking.date} · {booking.bookingStatus.replace('_', ' ')}</p>
                {booking.bookingStatus === 'completed' && (booking.review ? (
                  <div className="booking-row-rating">
                    <Star size={14} fill="currentColor" /> {booking.review.rating} star{booking.review.rating !== 1 ? 's' : ''}
                  </div>
                ) : (
                  <button className="text-link" onClick={() => setRatingBooking(booking)} style={{ margin: 0, padding: 0 }}>
                    Leave a review <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              <span className={`status status-${booking.bookingStatus}`}>{booking.bookingStatus.replace('_', ' ')}</span>
            </div>
          )) : (
            <div className="empty-state"><CalendarDays size={28} /><h3>No bookings yet</h3><p>Find a trusted local provider and your requests will appear here.</p><Link to="/services" className="text-link">Explore services <ArrowRight size={15} /></Link></div>
          )}
        </div>
      </main>

      {ratingBooking && <RatingModal booking={ratingBooking} onClose={() => setRatingBooking(null)} onSubmit={handleRatingSubmit} />}
    </>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  if (user?.role === 'provider') return <ProviderDashboard />
  return <CustomerDashboard />
}
