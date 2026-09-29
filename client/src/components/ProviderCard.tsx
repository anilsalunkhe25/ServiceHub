import { useState } from 'react'
import { ArrowRight, BadgeCheck, Heart, MapPin, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Provider as ApiProvider } from '../api'

export function ProviderCard({ provider, onBook }: { provider: ApiProvider; onBook: (provider: ApiProvider) => void }) {
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
            <button onClick={() => onBook(provider)}>Book</button>
          </div>
        </div>
      </div>
    </article>
  )
}
