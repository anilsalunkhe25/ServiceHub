import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Ban, CalendarDays, CalendarClock, Check, Clock3, CreditCard, FileText, Heart, LoaderCircle, LogOut, MessageCircle, Send, Star, Trash2, X, XCircle } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { getBookingMessages, getProviderWithdrawals, recordDemoPayment, requestProviderWithdrawal, sendBookingMessage, submitBookingComplaint, updateCustomerBooking, type Booking, type Provider, type ProviderWithdrawalSummary } from '../api'
import { useAuth } from '../context/AuthContext'
import {
  changeBookingStatus,
  fetchProviders,
  getErrorMessage,
  loadCustomerDetails,
  loadMyBookings,
  loadProviderBookings,
  removeService,
  sendReview,
  fetchMyService,
  persistService,
} from '../controllers/providerController'

const workingDayOptions = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

async function compressPortfolioImage(file: File) {
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to process this image')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to compress this image')), 'image/jpeg', 0.72)
  })
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read this image'))
    reader.onerror = () => reject(new Error('Unable to read this image'))
    reader.readAsDataURL(blob)
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
}

function printBookingInvoice(booking: Booking, providerName: string, customerName: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Allow pop-ups to generate the invoice.')
  const amount = (booking.amount || 0).toLocaleString('en-IN')
  printWindow.document.write(`<!doctype html><html><head><title>Invoice ${escapeHtml(booking._id)}</title><style>body{font:15px Arial,sans-serif;color:#17221f;max-width:760px;margin:48px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #146c63;padding-bottom:20px}h1{font-size:28px;margin:0}small{color:#68736f}table{width:100%;border-collapse:collapse;margin:32px 0}th,td{text-align:left;padding:13px;border-bottom:1px solid #dce5de}th:last-child,td:last-child{text-align:right}.total{text-align:right;font-size:20px;font-weight:bold}.details{line-height:1.8;color:#52615a}@media print{body{margin:0}}</style></head><body><header><div><h1>Service invoice</h1><small>Invoice #${escapeHtml(booking._id)}</small></div><div><strong>${escapeHtml(providerName)}</strong><br><small>Issued ${new Date().toLocaleDateString('en-IN')}</small></div></header><p class="details"><strong>Customer:</strong> ${escapeHtml(customerName)}<br><strong>Service date:</strong> ${escapeHtml(booking.date)} at ${escapeHtml(booking.time)}<br><strong>Service address:</strong> ${escapeHtml(booking.address)}</p><table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>${escapeHtml(booking.service)}${booking.description ? `<br><small>${escapeHtml(booking.description)}</small>` : ''}</td><td>₹${amount}</td></tr></tbody></table><p class="total">Total: ₹${amount}</p><p class="details">Payment method: ${booking.paymentMethod === 'upi' ? 'UPI' : 'Cash on delivery'}<br>Status: ${escapeHtml(booking.paymentStatus === 'paid' ? 'Paid' : 'Payment pending')}</p><script>window.onload=()=>window.print()</script></body></html>`)
  printWindow.document.close()
}

function ProviderServiceForm() {
  const [form, setForm] = useState({
    businessName: '',
    category: '',
    description: '',
    city: '',
    address: '',
    pricing: '',
    skills: '',
    serviceAreas: '',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as string[],
    startTime: '09:00',
    endTime: '17:00',
    pricingDetails: '',
    portfolioImages: [] as string[],
    isAvailable: true,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
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
          skills: (service.skills || []).join(', '),
          serviceAreas: (service.serviceAreas || []).join(', '),
          workingDays: service.workingHours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          startTime: service.workingHours?.start || '09:00',
          endTime: service.workingHours?.end || '17:00',
          pricingDetails: service.pricingDetails || '',
          portfolioImages: service.portfolioImages || [],
          isAvailable: service.isAvailable !== false,
        })
        localStorage.setItem('servicehub_my_service', JSON.stringify(service))
      }
    }).catch(() => {
      const saved = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null')
      if (saved) setForm(saved)
      else setStatus('Unable to load your service listing.')
    }).finally(() => setLoading(false))
  }, [])

  const updateField = <Field extends keyof typeof form>(field: Field, value: typeof form[Field]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const toggleWorkingDay = (day: string) => {
    updateField('workingDays', form.workingDays.includes(day) ? form.workingDays.filter((value) => value !== day) : [...form.workingDays, day])
  }

  const addPortfolioImages = async (files: FileList | null) => {
    if (!files?.length) return
    const selected = Array.from(files).slice(0, Math.max(0, 6 - form.portfolioImages.length))
    if (!selected.length) {
      setStatus('A portfolio can contain up to 6 photos.')
      return
    }
    try {
      const images = await Promise.all(selected.map(compressPortfolioImage))
      updateField('portfolioImages', [...form.portfolioImages, ...images])
      setStatus('')
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : 'Unable to upload these photos.')
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(isEditing ? 'Updating...' : 'Saving...')

    try {
      const wasEditing = isEditing
      const service = await persistService({
        businessName: form.businessName,
        category: form.category,
        description: form.description,
        city: form.city,
        address: form.address,
        pricing: form.pricing,
        skills: form.skills.split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean),
        serviceAreas: form.serviceAreas.split(/[,;\n]/).map((area) => area.trim()).filter(Boolean),
        workingHours: { days: form.workingDays, start: form.startTime, end: form.endTime },
        pricingDetails: form.pricingDetails,
        portfolioImages: form.portfolioImages,
        isAvailable: form.isAvailable,
      }, wasEditing)
      localStorage.setItem('servicehub_my_service', JSON.stringify(service))
      setStatus(wasEditing ? 'Your service has been updated.' : 'Your service is live in the customer marketplace.')
      setIsEditing(false)
      setShowForm(false)
      setTimeout(() => setStatus(''), 2500)
    } catch (reason) {
      setStatus(getErrorMessage(reason))
    }
  }

  const deleteService = async () => {
    if (!window.confirm('Are you sure you want to delete your service listing? This cannot be undone.')) return
    setStatus('Deleting...')

    try {
      await removeService()
      setForm({ businessName: '', category: '', description: '', city: '', address: '', pricing: '', skills: '', serviceAreas: '', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], startTime: '09:00', endTime: '17:00', pricingDetails: '', portfolioImages: [], isAvailable: true })
      setIsEditing(false)
      setShowForm(false)
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
        <h2>{form.businessName ? <>Manage <span>your service.</span></> : <>Create <span>your service.</span></>}</h2>
        <p>{form.businessName ? 'Your listing is available in the customer marketplace.' : 'Publish a service listing when you are ready to receive bookings.'}</p>
      </div>

      {loading ? <LoaderCircle className="loader" /> : form.businessName && !showForm ? (
        <div className="service-summary">
          <div>
            <strong>{form.businessName}</strong>
            <p>{form.category} · {form.city}</p>
            <p>{form.pricing || 'Price on request'}</p>
            <p>{form.isAvailable ? 'Accepting bookings' : 'Currently unavailable'}</p>
            {form.skills && <p>Skills: {form.skills}</p>}
            {form.serviceAreas && <p>Service areas: {form.serviceAreas}</p>}
            {form.pricingDetails && <p>Rates: {form.pricingDetails}</p>}
            <p>Hours: {form.workingDays.join(', ') || 'No days selected'} · {form.startTime}–{form.endTime}</p>
            {form.description && <small>{form.description}</small>}
            {form.portfolioImages.length > 0 && <div className="provider-portfolio-preview">{form.portfolioImages.map((image, index) => <img key={index} src={image} alt={`${form.businessName} portfolio ${index + 1}`} />)}</div>}
          </div>
          <div className="service-summary-actions">
            <button type="button" className="dark-button" onClick={() => { setIsEditing(true); setShowForm(true); setStatus('') }}>Edit service</button>
            <button type="button" className="reject-button" onClick={deleteService}>Delete service</button>
          </div>
          {status && <p className={status.startsWith('Unable') ? 'form-error' : 'form-status'}>{status}</p>}
        </div>
      ) : !showForm ? (
        <div className="service-create-action">
          <button type="button" className="auth-submit" onClick={() => { setShowForm(true); setStatus('') }}>
            Create service <ArrowRight size={16} />
          </button>
          {status && <p className={status.startsWith('Unable') ? 'form-error' : 'form-status'}>{status}</p>}
        </div>
      ) : (
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
            <label>
              Skills (comma separated)
              <input value={form.skills} onChange={(event) => updateField('skills', event.target.value)} placeholder="Repairs, installation, maintenance" />
            </label>
            <label>
              Service areas (comma separated)
              <input value={form.serviceAreas} onChange={(event) => updateField('serviceAreas', event.target.value)} placeholder="Pune, Pimpri-Chinchwad" />
            </label>
            <label>
              Starting hours
              <input type="time" value={form.startTime} onChange={(event) => updateField('startTime', event.target.value)} required />
            </label>
            <label>
              Closing hours
              <input type="time" value={form.endTime} onChange={(event) => updateField('endTime', event.target.value)} required />
            </label>
            <div className="editor-wide provider-setting-group">
              <span>Working days</span>
              <div className="provider-day-picker">{workingDayOptions.map((day) => <label key={day}><input type="checkbox" checked={form.workingDays.includes(day)} onChange={() => toggleWorkingDay(day)} /> {day}</label>)}</div>
            </div>
            <label className="editor-wide">
              Detailed pricing
              <textarea value={form.pricingDetails} onChange={(event) => updateField('pricingDetails', event.target.value)} placeholder="Example: inspection ₹199 · installation from ₹499" rows={2} />
            </label>
            <label className="editor-wide provider-availability-toggle">
              <input type="checkbox" checked={form.isAvailable} onChange={(event) => updateField('isAvailable', event.target.checked)} />
              Accept new bookings
            </label>
            <div className="editor-wide provider-portfolio-upload">
              <label>Portfolio photos (up to 6)<input type="file" accept="image/*" multiple onChange={(event) => { void addPortfolioImages(event.currentTarget.files); event.currentTarget.value = '' }} /></label>
              <div className="provider-portfolio-preview">{form.portfolioImages.map((image, index) => <div className="portfolio-thumb" key={`${index}-${image.slice(-16)}`}><img src={image} alt={`Portfolio photo ${index + 1}`} /><button type="button" aria-label={`Remove portfolio photo ${index + 1}`} onClick={() => updateField('portfolioImages', form.portfolioImages.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></div>)}</div>
            </div>
          </div>

          <div className="service-form-actions">
            <button type="submit" className="auth-submit">
              {isEditing ? 'Update service' : 'Publish service'}
              <ArrowRight size={16} />
            </button>
            <button type="button" className="reject-button" onClick={() => { setShowForm(false); setIsEditing(false); setStatus('') }}>Cancel</button>
          </div>

          {status && <p className={status.startsWith('Unable') || status.includes('required') || status.includes('Authentication') ? 'form-error' : 'form-status'}>{status}</p>}
        </form>
      )}
    </section>
  )
}

function ProviderBookingRow({ booking, onStatusChange, onChat, onInvoice }: { booking: Booking; onStatusChange: (booking: Booking, status: Booking['bookingStatus']) => void; onChat: (booking: Booking) => void; onInvoice: (booking: Booking, customerName: string) => void }) {
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
    cancelled: null,
  }

  const action = nextAction[booking.bookingStatus]

  return (
    <article className="provider-booking-row">
      <div className="booking-row-main">
        <CalendarDays size={20} />
        <div>
          <strong>{booking.service}</strong>
          <p>{booking.date} · {booking.time} · {booking.address}</p>
          <p>Payment: {booking.paymentMethod === 'upi' ? 'UPI' : 'Cash on delivery'}</p>
          {customer && <p style={{ fontSize: '14px', color: '#666' }}>📞 {customer.phone || 'Phone not provided'}</p>}
          <small>{booking.description || 'No additional details provided.'}</small>
          {booking.complaint && <div className="booking-complaint"><strong>Customer complaint for {booking.complaint.providerBusinessName || booking.providerBusinessName || 'your service'}</strong><p>{booking.complaint.message}</p></div>}
          {booking.review && <div className="provider-review"><strong><Star size={13} fill="currentColor" /> {booking.review.rating}/5 customer review</strong>{booking.review.comment && <p>{booking.review.comment}</p>}</div>}
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
      {booking.bookingStatus === 'completed' && <div className="booking-actions"><button className="dashboard-refresh" onClick={() => onInvoice(booking, customer?.name || 'Customer')}><FileText size={15} /> Generate invoice</button></div>}
      <div className="booking-actions"><button className="dashboard-refresh" onClick={() => onChat(booking)}><MessageCircle size={15} /> Chat with customer{booking.messages?.length ? ` (${booking.messages.length})` : ''}</button></div>
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

type CustomerAction = 'message' | 'complaint' | 'reschedule'

function CustomerActionModal({ booking, action, onClose, onUpdated }: { booking: Booking; action: CustomerAction; onClose: () => void; onUpdated: (booking: Booking) => void }) {
  const { user } = useAuth()
  const [record, setRecord] = useState(booking)
  const [message, setMessage] = useState('')
  const [date, setDate] = useState(booking.date)
  const [time, setTime] = useState(booking.time)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (action !== 'message') return
    let active = true
    const refreshMessages = async () => {
      try {
        const messages = await getBookingMessages(record._id)
        if (active) {
          setRecord((current) => JSON.stringify(current.messages || []) === JSON.stringify(messages) ? current : { ...current, messages })
        }
      } catch {
        // Keep the existing thread visible if a refresh fails.
      }
    }

    refreshMessages()
    const interval = window.setInterval(refreshMessages, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [action, record._id])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const updated = action === 'message'
        ? await sendBookingMessage(record._id, message)
        : action === 'complaint'
          ? await submitBookingComplaint(record._id, message)
          : await updateCustomerBooking(record._id, 'reschedule', date, time)
      setRecord(updated)
      onUpdated(updated)
      if (action === 'message') setMessage('')
      else onClose()
    } catch (reason) {
      setError(getErrorMessage(reason))
    } finally {
      setLoading(false)
    }
  }

  const title = action === 'message' ? 'Message provider' : action === 'complaint' ? 'Raise a complaint' : 'Reschedule booking'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal customer-action-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <p className="kicker">{action === 'complaint' ? record.providerBusinessName || record.service : record.service}</p>
        <h2>{title}</h2>
        {action === 'message' && (
          <div className="message-thread" aria-live="polite">
            {record.messages?.length ? record.messages.map((item, index) => (
              <p className={`message-bubble ${item.senderRole === user?.role ? 'mine' : ''}`} key={`${item.createdAt}-${index}`}>
                <small>{item.senderRole === user?.role ? 'You' : item.senderRole === 'provider' ? 'Provider' : 'Customer'}</small>{item.message}
              </p>
            )) : <p className="modal-muted">No messages yet. Start the conversation with your provider.</p>}
          </div>
        )}
        <form onSubmit={submit}>
          {action === 'reschedule' ? (
            <div className="reschedule-fields">
              <label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
              <label>Time<select value={time} onChange={(event) => setTime(event.target.value)} required><option>09:00 AM</option><option>12:00 PM</option><option>03:00 PM</option><option>06:00 PM</option></select></label>
            </div>
          ) : (
            <label>{action === 'message' ? 'Your message' : action === 'complaint' ? `Complaint for ${record.providerBusinessName || 'this provider'}` : 'What went wrong?' }<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={action === 'complaint' ? 10 : 1} maxLength={action === 'complaint' ? 2000 : 1000} required placeholder={action === 'message' ? 'Write a message...' : 'Describe the issue (at least 10 characters)'} /></label>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="modal-submit" disabled={loading}>
            {loading ? 'Saving...' : action === 'message' ? 'Send message' : action === 'complaint' ? 'Submit complaint' : 'Request new time'}
            {action === 'message' ? <Send size={15} /> : <ArrowRight size={15} />}
          </button>
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
  const [chatBooking, setChatBooking] = useState<Booking | null>(null)
  const [withdrawalSummary, setWithdrawalSummary] = useState<ProviderWithdrawalSummary | null>(null)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [payoutUpiId, setPayoutUpiId] = useState('')
  const [withdrawalStatus, setWithdrawalStatus] = useState('')
  const [withdrawalLoading, setWithdrawalLoading] = useState(false)

  const load = () => {
    setLoading(true)
    loadProviderBookings().then(setBookings).catch(() => setError('Unable to load booking requests.')).finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    const refresh = () => {
      loadProviderBookings()
        .then((items) => { if (active) setBookings(items) })
        .catch(() => { if (active) setError('Unable to load booking requests.') })
        .finally(() => { if (active) setLoading(false) })
    }

    refresh()
    const interval = window.setInterval(refresh, 4000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    getProviderWithdrawals().then(setWithdrawalSummary).catch((reason) => setWithdrawalStatus(getErrorMessage(reason)))
  }, [])


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
  const completedBookings = bookings.filter((booking) => booking.bookingStatus === 'completed')
  const earnings = completedBookings.reduce((total, booking) => total + (booking.amount || 0), 0)
  const reviewedBookings = bookings.filter((booking) => booking.review)
  const averageRating = reviewedBookings.length ? reviewedBookings.reduce((total, booking) => total + (booking.review?.rating || 0), 0) / reviewedBookings.length : 0
  const activeRequests = bookings.filter((booking) => !['cancelled', 'rejected'].includes(booking.bookingStatus))
  const acceptedRequests = activeRequests.filter((booking) => ['accepted', 'on_the_way', 'in_progress', 'completed'].includes(booking.bookingStatus))
  const acceptanceRate = activeRequests.length ? Math.round(acceptedRequests.length / activeRequests.length * 100) : 0

  const generateInvoice = (booking: Booking, customerName: string) => {
    try {
      printBookingInvoice(booking, booking.providerBusinessName || user?.name || 'Service provider', customerName)
    } catch (reason) {
      setError(getErrorMessage(reason))
    }
  }

  const submitWithdrawal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setWithdrawalLoading(true)
    setWithdrawalStatus('')
    try {
      const result = await requestProviderWithdrawal(Number(withdrawalAmount), payoutUpiId)
      setWithdrawalSummary((current) => ({
        availableAmount: result.availableAmount,
        withdrawals: [result.withdrawal, ...(current?.withdrawals || [])],
      }))
      setWithdrawalAmount('')
      setWithdrawalStatus('Withdrawal request submitted and pending review.')
    } catch (reason) {
      setWithdrawalStatus(getErrorMessage(reason))
    } finally {
      setWithdrawalLoading(false)
    }
  }

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
          <div className="dash-stat"><span>Completed jobs</span><strong>{completedBookings.length}</strong><small>Finished appointments</small></div>
          <div className="dash-stat"><span>Total earnings</span><strong>₹{earnings.toLocaleString('en-IN')}</strong><small>Completed bookings</small></div>
          <div className="dash-stat"><span>Open requests</span><strong>{pendingCount}</strong><small>Need your attention</small></div>
          <div className="dash-stat"><span>Average rating</span><strong>{averageRating ? averageRating.toFixed(1) : '—'}</strong><small>{reviewedBookings.length} customer reviews</small></div>
          <div className="dash-stat"><span>Acceptance rate</span><strong>{acceptanceRate}%</strong><small>Of active requests</small></div>
          <div className="dash-stat"><span>Average job value</span><strong>₹{completedBookings.length ? Math.round(earnings / completedBookings.length).toLocaleString('en-IN') : '0'}</strong><small>Completed bookings</small></div>
        </div>

        <section className="container provider-earnings-panel">
          <div className="provider-earnings-balance"><p className="kicker">Provider earnings</p><h2>₹{(withdrawalSummary?.availableAmount ?? earnings).toLocaleString('en-IN')}</h2><span>Available to request</span><small>Requests are recorded as pending; funds are not transferred automatically.</small></div>
          <form onSubmit={submitWithdrawal}>
            <h3>Request a withdrawal</h3>
            <label>Amount<input type="number" min="1" max={withdrawalSummary?.availableAmount ?? earnings} step="1" value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} required /></label>
            <label>UPI ID<input value={payoutUpiId} onChange={(event) => setPayoutUpiId(event.target.value)} placeholder="name@bank" pattern="[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}" required /></label>
            <button className="auth-submit" disabled={withdrawalLoading || !withdrawalSummary?.availableAmount}>{withdrawalLoading ? 'Submitting...' : 'Request withdrawal'} <ArrowRight size={15} /></button>
            {withdrawalStatus && <p className={withdrawalStatus.toLowerCase().includes('unable') || withdrawalStatus.toLowerCase().includes('exceeds') || withdrawalStatus.toLowerCase().includes('valid') ? 'form-error' : 'form-status'}>{withdrawalStatus}</p>}
          </form>
          <div className="provider-withdrawal-history"><h3>Withdrawal requests</h3>{withdrawalSummary?.withdrawals.length ? withdrawalSummary.withdrawals.map((item) => <div key={item._id}><span>₹{item.amount.toLocaleString('en-IN')} · {item.payoutUpiId}</span><strong className={`withdrawal-status withdrawal-${item.status}`}>{item.status}</strong></div>) : <p>No withdrawal requests yet.</p>}</div>
        </section>

        <div className="container booking-list">
          <div className="section-heading">
            <div><p className="kicker">Incoming work</p><h2>Booking <span>requests.</span></h2></div>
            <button className="dashboard-refresh" onClick={load}>Refresh</button>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading ? <LoaderCircle className="loader" /> : bookings.length ? bookings.map((booking) => <ProviderBookingRow booking={booking} onStatusChange={changeStatus} onChat={setChatBooking} onInvoice={generateInvoice} key={booking._id} />) : <div className="empty-state"><CalendarDays size={28} /><h3>No booking requests</h3><p>New customer requests will appear here.</p></div>}
        </div>
      </main>
      {chatBooking && <CustomerActionModal key={chatBooking._id} booking={chatBooking} action="message" onClose={() => setChatBooking(null)} onUpdated={(updated) => setBookings((items) => items.map((item) => item._id === updated._id ? updated : item))} />}
    </>
  )
}

function CustomerDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [favoriteProviders, setFavoriteProviders] = useState<Provider[]>([])
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null)
  const [actionBooking, setActionBooking] = useState<{ booking: Booking; action: CustomerAction } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      loadMyBookings().then(setBookings).catch(() => setError('Unable to load your booking history.'))
    }
  }, [user])

  useEffect(() => {
    fetchProviders({}).then((providers) => {
      const savedIds = Object.keys(localStorage).filter((key) => key.startsWith('favorite_') && localStorage.getItem(key) === 'true').map((key) => key.slice('favorite_'.length))
      setFavoriteProviders(providers.filter((provider) => savedIds.includes(provider._id || provider.businessName)))
    })
  }, [])

  const updateBooking = (updated: Booking) => setBookings((items) => items.map((item) => item._id === updated._id ? updated : item))

  const payBooking = async (booking: Booking) => {
    try {
      updateBooking(await recordDemoPayment(booking._id))
    } catch (reason) {
      setError(getErrorMessage(reason))
    }
  }

  const cancelBooking = async (booking: Booking) => {
    if (!window.confirm('Cancel this booking request?')) return
    try {
      updateBooking(await updateCustomerBooking(booking._id, 'cancel'))
    } catch (reason) {
      setError(getErrorMessage(reason))
    }
  }

  const removeFavorite = (provider: Provider) => {
    const key = provider._id || provider.businessName
    localStorage.setItem(`favorite_${key}`, 'false')
    setFavoriteProviders((items) => items.filter((item) => (item._id || item.businessName) !== key))
  }

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

          {error && <p className="form-error">{error}</p>}
          {bookings.length ? bookings.map((booking) => (
            <article className="booking-row booking-row-expanded" key={booking._id}>
              <CalendarDays size={20} />
              <div>
                <strong>{booking.service}</strong>
                <p>{booking.date} · {booking.time} · {booking.address}</p>
                {booking.urgent && <span className="emergency-booking-note"><AlertTriangle size={13} /> Emergency request</span>}
                {booking.amount !== undefined && <p>Quoted amount: ₹{booking.amount.toLocaleString('en-IN')}</p>}
                {booking.bookingStatus === 'completed' && (booking.review ? (
                  <div className="booking-row-rating">
                    <Star size={14} fill="currentColor" /> {booking.review.rating} star{booking.review.rating !== 1 ? 's' : ''}
                  </div>
                ) : (
                  <button className="text-link" onClick={() => setRatingBooking(booking)} style={{ margin: 0, padding: 0 }}>
                    Leave a review <ArrowRight size={14} />
                  </button>
                ))}
                {booking.complaint && <p className="complaint-status">Complaint for {booking.complaint.providerBusinessName || booking.providerBusinessName || 'provider'} · {booking.complaint.status}</p>}
              </div>
              <div className="booking-row-side">
                <span className={`status status-${booking.bookingStatus}`}>{booking.bookingStatus.replace('_', ' ')}</span>
                <span className="payment-status">{booking.paymentStatus === 'paid' ? 'UPI paid' : booking.paymentMethod === 'upi' ? 'UPI selected' : 'Cash on delivery'}</span>
              </div>
              <div className="customer-booking-actions">
                {booking.paymentMethod === 'upi' && booking.paymentStatus !== 'paid' && !['cancelled', 'rejected'].includes(booking.bookingStatus) && <button onClick={() => payBooking(booking)}><CreditCard size={14} /> Record demo UPI payment ₹{(booking.amount || 0).toLocaleString('en-IN')}</button>}
                <button onClick={() => setActionBooking({ booking, action: 'message' })}><MessageCircle size={14} /> Chat</button>
                {['pending', 'accepted'].includes(booking.bookingStatus) && <button onClick={() => setActionBooking({ booking, action: 'reschedule' })}><CalendarClock size={14} /> Reschedule</button>}
                {['pending', 'accepted'].includes(booking.bookingStatus) && <button className="cancel-booking-action" onClick={() => cancelBooking(booking)}><Ban size={14} /> Cancel</button>}
                {!booking.complaint && <button onClick={() => setActionBooking({ booking, action: 'complaint' })}><AlertTriangle size={14} /> Complaint</button>}
              </div>
            </article>
          )) : (
            <div className="empty-state"><CalendarDays size={28} /><h3>No bookings yet</h3><p>Find a trusted local provider and your requests will appear here.</p><Link to="/services" className="text-link">Explore services <ArrowRight size={15} /></Link></div>
          )}
        </div>

        <section className="container saved-providers-section">
          <div className="section-heading"><div><p className="kicker">Your shortlist</p><h2>Saved <span>providers.</span></h2></div><Link to="/services" className="text-link">Compare more <ArrowRight size={15} /></Link></div>
          {favoriteProviders.length ? favoriteProviders.map((provider) => (
            <div className="saved-provider-row" key={provider._id || provider.businessName}>
              <Heart size={17} fill="currentColor" />
              <div><strong>{provider.businessName}</strong><p>{provider.category} · {provider.city} · {provider.pricing || 'Price on request'} · ★ {provider.rating}</p></div>
              <Link to={`/providers/${provider._id}`}>View</Link>
              <button onClick={() => removeFavorite(provider)} aria-label={`Remove ${provider.businessName} from favorites`}><X size={16} /></button>
            </div>
          )) : <p className="saved-providers-empty">Tap the heart on a provider card to keep it here.</p>}
        </section>
      </main>

      {ratingBooking && <RatingModal booking={ratingBooking} onClose={() => setRatingBooking(null)} onSubmit={handleRatingSubmit} />}
      {actionBooking && <CustomerActionModal key={`${actionBooking.booking._id}-${actionBooking.action}`} booking={actionBooking.booking} action={actionBooking.action} onClose={() => setActionBooking(null)} onUpdated={updateBooking} />}
    </>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  if (user?.role === 'provider') return <ProviderDashboard />
  return <CustomerDashboard />
}
