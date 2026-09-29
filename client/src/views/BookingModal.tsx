import { useState, type FormEvent } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Provider as ApiProvider } from '../api'
import { useAuth } from '../context/AuthContext'
import { createBookingRequest } from '../controllers/providerController'

export function BookingModal({ provider, onClose }: { provider: ApiProvider; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      onClose()
      navigate('/login')
      return
    }

    const form = new FormData(event.currentTarget)
    setStatus('loading')

    try {
      await createBookingRequest({
        providerId: provider._id || '',
        service: provider.category,
        date: String(form.get('date')),
        time: String(form.get('time')),
        address: String(form.get('address')),
        description: String(form.get('description')),
        amount: Number((provider.pricing || '').replace(/\D/g, '')) || 0,
      })

      setStatus('Booking requested. You can track it in your dashboard.')
      setTimeout(onClose, 1800)
    } catch {
      setStatus('Booking could not be created. Please check the API and try again.')
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

        {!user && <p className="auth-hint">You will be asked to log in before your request is submitted.</p>}

        <form onSubmit={submit}>
          <label>
            Date
            <input name="date" type="date" required />
          </label>

          <label>
            Time
            <select name="time" required>
              <option value="">Choose a time</option>
              <option>09:00 AM</option>
              <option>12:00 PM</option>
              <option>03:00 PM</option>
              <option>06:00 PM</option>
            </select>
          </label>

          <label>
            Address
            <input name="address" placeholder="Service address" required />
          </label>

          <label>
            What do you need help with?
            <textarea name="description" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add a short description" required />
          </label>

          <button className="modal-submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending request...' : user ? 'Request booking' : 'Continue to login'}
            <ArrowRight size={16} />
          </button>
        </form>

        {status && status !== 'loading' && <p className="form-status">{status}</p>}
      </div>
    </div>
  )
}
