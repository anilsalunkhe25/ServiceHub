import { useState } from 'react'
import { ArrowRight, BadgeCheck, Heart, MapPin, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Provider as ApiProvider } from '../api'

export function ProviderCard({ provider, onBook, onCompare, compared = false, compareDisabled = false }: { provider: ApiProvider; onBook: (provider: ApiProvider) => void; onCompare?: (provider: ApiProvider) => void; compared?: boolean; compareDisabled?: boolean }) {
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem(`favorite_${provider._id}`) || 'false'))

  const toggle = () => {
    const next = !saved
    setSaved(next)
    localStorage.setItem(`favorite_${provider._id}`, JSON.stringify(next))
  }

  return (
    <article className="provider-card">
      <div className="provider-image">
        <div className="provider-avatar">{provider.businessName.charAt(0)}</div>
        <button className={`heart-button ${saved ? 'saved' : ''}`} onClick={toggle} aria-label="Save provider">
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="provider-info">
        <div className="provider-meta">
          <span>{provider.category}</span>
          <b>
            <Star size={13} fill="currentColor" /> {provider.rating}
          </b>
        </div>

        <h3>{provider.businessName}</h3>
        <p>
          <MapPin size={14} /> {provider.city} · {provider.totalReviews} reviews
        </p>
        {provider.serviceAreas?.length ? <p className="provider-area-summary">Areas: {provider.serviceAreas.slice(0, 2).join(', ')}</p> : null}
        {provider.pricingDetails && <small className="provider-rate-summary">{provider.pricingDetails}</small>}
        {provider.isAvailable === false && <small className="provider-unavailable">Not accepting bookings</small>}

        {provider.isVerified && (
          <small className="verified">
            <BadgeCheck size={13} /> Verified provider
          </small>
        )}

        <div className="provider-bottom">
          <strong>{provider.pricing || 'Price on request'}</strong>
          <div className="card-actions">
            <Link to={`/providers/${provider._id}`}>
              View profile <ArrowRight size={15} />
            </Link>
            {onCompare && <button className="compare-provider-button" aria-pressed={compared} disabled={compareDisabled && !compared} onClick={() => onCompare(provider)}>{compared ? 'Added' : 'Compare'}</button>}
            <button onClick={() => onBook(provider)} disabled={provider.isFallback || provider.isAvailable === false} title={provider.isFallback ? 'Connect to the service API to book this provider' : undefined}>
              {provider.isFallback || provider.isAvailable === false ? 'Unavailable' : 'Book'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
