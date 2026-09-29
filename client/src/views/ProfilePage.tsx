import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Clock3, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { fallbackProviders } from '../data/mockData'
import type { Provider as ApiProvider } from '../api'
import { fetchProviderById } from '../controllers/providerController'
import { BookingModal } from './BookingModal'

export function ProfilePage() {
  const { id } = useParams()
  const savedService = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null') as ApiProvider | null
  const savedMatch = savedService && savedService._id === id ? savedService : null
  const [provider, setProvider] = useState<ApiProvider>(savedMatch || fallbackProviders[0])
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    if (id) {
      fetchProviderById(id).then(setProvider).catch(() => {
        setProvider(savedMatch || fallbackProviders.find((item) => item._id === id) || fallbackProviders[0])
      })
    }
  }, [id])

  return (
    <>
      <Navigation />
      <main className="profile-page">
        <div className="container profile-hero">
          <Link to="/services" className="text-link">← Back to services</Link>
          <div className="profile-card">
            <div className="profile-avatar">{provider.businessName.charAt(0)}</div>
            <div>
              <p className="kicker">{provider.category} · {provider.city}</p>
              <h1>{provider.businessName}</h1>
              <p>{provider.description}</p>
              <div className="profile-rating">
                <Star size={16} fill="currentColor" /> {provider.rating} · {provider.totalReviews} reviews
                {provider.isVerified && <span><BadgeCheck size={15} /> Verified</span>}
              </div>
              {provider.skills?.length ? <p><strong>Skills:</strong> {provider.skills.join(', ')}</p> : null}
              {provider.serviceAreas?.length ? <p><strong>Service areas:</strong> {provider.serviceAreas.join(', ')}</p> : null}
              {provider.pricingDetails && <p className="profile-rates"><strong>Rates:</strong> {provider.pricingDetails}</p>}
              {provider.workingHours && <p className="profile-hours"><Clock3 size={14} /> {provider.workingHours.days.join(', ')} · {provider.workingHours.start}–{provider.workingHours.end}</p>}
              {provider.isAvailable === false && <p className="provider-unavailable">Currently not accepting bookings</p>}
              {provider.portfolioImages?.length ? <div className="profile-portfolio" aria-label="Portfolio photos">{provider.portfolioImages.map((image, index) => <img key={index} src={image} alt={`${provider.businessName} portfolio ${index + 1}`} />)}</div> : null}
            </div>
            <button className="dark-button" onClick={() => setBooking(true)} disabled={provider.isFallback || provider.isAvailable === false} title={provider.isFallback ? 'Connect to the service API to book this provider' : undefined}>
              {provider.isAvailable === false ? 'Unavailable' : 'Book service'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>

      {booking && <BookingModal provider={provider} onClose={() => setBooking(false)} />}
    </>
  )
}
