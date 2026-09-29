import { ArrowRight, BadgeCheck, CalendarDays, Star, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { ProviderCard } from '../components/ProviderCard'
import { SearchPanel } from '../components/SearchPanel'
import { categories, fallbackProviders } from '../data/mockData'
import { fetchProviders } from '../controllers/providerController'
import { useEffect, useState } from 'react'
import type { Provider as ApiProvider } from '../api'
import { BookingModal } from './BookingModal'

function ProviderShowcase({ onBook }: { onBook: (provider: ApiProvider) => void }) {
  const [items, setItems] = useState(fallbackProviders)

  useEffect(() => {
    fetchProviders({}).then((result) => {
      const saved = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null') as ApiProvider | null
      setItems(saved && !result.some((provider) => provider._id === saved._id) ? [saved, ...result] : result)
    }).catch(() => setItems(fallbackProviders))
  }, [])

  return (
    <section className="provider-section" id="cities">
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="kicker">Loved by your neighbours</p>
            <h2>Meet the <span>standouts.</span></h2>
          </div>
          <Link to="/services" className="text-link">Browse all providers <ArrowRight size={16} /></Link>
        </div>

        <div className="provider-grid">
          {items.slice(0, 3).map((provider) => (
            <ProviderCard provider={provider} onBook={onBook} key={provider._id || provider.businessName} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  const [bookingProvider, setBookingProvider] = useState<ApiProvider | null>(null)

  return (
    <>
      <Navigation />
      <main>
        <section className="hero">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-dot" /> Local help, made simple</p>
              <h1>Good help is <em>closer</em> than you think.</h1>
              <p className="hero-text">Find trusted local pros for the moments that keep your city life moving.</p>
              <SearchPanel />
              <div className="trust-row">
                <div className="avatar-stack">
                  <span>R</span><span>A</span><span>S</span><span>+</span>
                </div>
                <p><strong>12,000+</strong> people found their pro this month</p>
              </div>
            </div>

            <div className="hero-visual">
              <div className="main-image">
                <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85" alt="Professional home service provider at work" />
                <div className="image-caption">
                  <span className="online-dot" /> Available today <strong>4.9 <Star size={13} fill="currentColor" /></strong>
                </div>
              </div>

              <div className="floating-note note-top">
                <BadgeCheck size={19} />
                <span><strong>Verified pros</strong><small>Background checked</small></span>
              </div>

              <div className="floating-note note-bottom">
                <div className="mini-icon"><CalendarDays size={17} /></div>
                <span><strong>Book in minutes</strong><small>Simple, transparent pricing</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="category-band">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="kicker">Start exploring</p>
                <h2>Whatever you need, <span>we know a pro.</span></h2>
              </div>
              <Link to="/services" className="text-link">View all services <ArrowRight size={16} /></Link>
            </div>

            <div className="category-grid">
              {categories.map(([title, detail, icon]) => (
                <Link to={`/services?category=${encodeURIComponent(title)}`} className="category-item" key={title}>
                  <span className="category-icon">{icon}</span>
                  <span><strong>{title}</strong><small>{detail}</small></span>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <ProviderShowcase onBook={setBookingProvider} />
      </main>

      <section className="how-section" id="how">
        <div className="container how-grid">
          <div>
            <p className="kicker">The easy way to get it done</p>
            <h2>City life is busy.<br /><span>We make it lighter.</span></h2>
            <p className="how-copy">Search, compare and book a trusted local provider in a few simple steps.</p>
            <Link to="/services" className="dark-button">Find your local pro <ArrowRight size={17} /></Link>
          </div>

          <div className="steps">
            <div className="step"><span>01</span><div><h3>Tell us what you need</h3><p>Search by service, browse categories, or describe the job.</p></div></div>
            <div className="step"><span>02</span><div><h3>Compare with confidence</h3><p>See real reviews, clear pricing and verified local businesses.</p></div></div>
            <div className="step"><span>03</span><div><h3>Book on your terms</h3><p>Choose a time that works, then track it in your dashboard.</p></div></div>
          </div>
        </div>
      </section>

      <section className="emergency">
        <div className="container emergency-inner">
          <div>
            <p className="kicker">Need a hand right now?</p>
            <h2>Fast help for the <em>unexpected.</em></h2>
          </div>
          <Link to="/services?urgent=true" className="light-button"><Zap size={16} fill="currentColor" /> Explore emergency services</Link>
        </div>
      </section>

      <footer id="about">
        <div className="container footer-inner">
          <Link to="/" className="brand">
            <span className="brand-mark"><Zap size={18} fill="currentColor" /></span>
            service<span>hub</span>
          </Link>
          <p>Your city. Your services. One hub.</p>
          <small>© 2025 Service Hub. Built for better city living.</small>
        </div>
      </footer>

      {bookingProvider && <BookingModal provider={bookingProvider} onClose={() => setBookingProvider(null)} />}
    </>
  )
}
