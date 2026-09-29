import { useEffect, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import type { Provider as ApiProvider } from '../api'
import { Navigation } from '../components/Navigation'
import { ProviderCard } from '../components/ProviderCard'
import { categories, fallbackProviders } from '../data/mockData'
import { fetchProviders } from '../controllers/providerController'
import { BookingModal } from './BookingModal'

export function ServicesPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [search, setSearch] = useState(params.get('search') || '')
  const [city, setCity] = useState(params.get('city') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [items, setItems] = useState<ApiProvider[]>(fallbackProviders)
  const [loading, setLoading] = useState(true)
  const [bookingProvider, setBookingProvider] = useState<ApiProvider | null>(null)
  const [comparison, setComparison] = useState<ApiProvider[]>([])
  const urgent = params.get('urgent') === 'true'

  const toggleCompare = (provider: ApiProvider) => {
    const key = provider._id || provider.businessName
    setComparison((current) => current.some((item) => (item._id || item.businessName) === key)
      ? current.filter((item) => (item._id || item.businessName) !== key)
      : current.length < 3 ? [...current, provider] : current)
  }

  useEffect(() => {
    setLoading(true)

    fetchProviders({ search, city, category }).then((result) => {
      const saved = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null') as ApiProvider | null
      const localMatch = saved && (!search || [saved.businessName, saved.category].some((value) => value.toLowerCase().includes(search.toLowerCase()))) && (!city || saved.city === city) && (!category || saved.category === category)
        ? [saved]
        : []

      const providers = [...localMatch, ...result.filter((provider) => provider._id !== saved?._id)]
      setItems(providers.length ? providers : fallbackProviders)
    }).catch(() => setItems(fallbackProviders)).finally(() => setLoading(false))
  }, [search, city, category])

  return (
    <>
      <Navigation />
      <main className="services-page">
        <div className="container services-header">
          <p className="kicker">{urgent ? 'Emergency service requests' : 'Your local shortlist'}</p>
          <h1>{urgent ? <>Find help <em>right now.</em></> : <>Find a pro for <em>anything.</em></>}</h1>
          <div className="service-search">
            <Search size={19} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services, businesses or cities" />
            <button onClick={() => setSearch(search.trim())}>Search</button>
          </div>
        </div>

        <div className="container results-layout">
          <aside>
            <p className="filter-title">Filter results</p>
            <label>
              City
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">All cities</option>
                <option>Pune</option>
                <option>Mumbai</option>
                <option>Kolhapur</option>
                <option>Bengaluru</option>
              </select>
            </label>

            <label>
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map(([name]) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </aside>

          <section className="results">
            <div className="results-toolbar">
              <strong>{loading ? 'Searching...' : `${items.length} trusted providers`}</strong>
              <div>
                <span>{comparison.length ? `${comparison.length} of 3 selected` : 'Compare up to 3 providers'}</span>
                <button onClick={() => { setSearch(''); setCity(''); setCategory('') }}>Clear filters</button>
              </div>
            </div>

            {loading ? (
              <LoaderCircle className="loader" />
            ) : (
              <div className="provider-grid">
                {items.map((provider) => (
                  <ProviderCard provider={provider} onBook={setBookingProvider} onCompare={toggleCompare} compared={comparison.some((item) => (item._id || item.businessName) === (provider._id || provider.businessName))} compareDisabled={comparison.length >= 3} key={provider._id || provider.businessName} />
                ))}
              </div>
            )}
          </section>
        </div>

        {comparison.length > 0 && (
          <section className="container comparison-panel" aria-label="Provider comparison">
            <div className="comparison-heading"><h2>Compare providers <span>side by side.</span></h2><button onClick={() => setComparison([])} aria-label="Clear comparison"><X size={17} /> Clear</button></div>
            <div className="comparison-grid" style={{ gridTemplateColumns: `repeat(${comparison.length + 1}, minmax(130px, 1fr))` }}>
              <strong className="compare-label">Provider</strong>{comparison.map((provider) => <strong key={provider._id || provider.businessName}>{provider.businessName}</strong>)}
              <span className="compare-label">Starting price</span>{comparison.map((provider) => <span key={provider._id || provider.businessName}>{provider.pricing || 'Price on request'}</span>)}
              <span className="compare-label">Rating</span>{comparison.map((provider) => <span key={provider._id || provider.businessName}>★ {provider.rating} ({provider.totalReviews} reviews)</span>)}
              <span className="compare-label">Service area</span>{comparison.map((provider) => <span key={provider._id || provider.businessName}>{provider.category} · {provider.city}</span>)}
              <span className="compare-label">Verification</span>{comparison.map((provider) => <span key={provider._id || provider.businessName}>{provider.isVerified ? 'Verified' : 'Not verified'}</span>)}
              <span className="compare-label">Choose</span>{comparison.map((provider) => <button key={provider._id || provider.businessName} disabled={provider.isFallback} title={provider.isFallback ? 'Connect to the service API to book this provider' : undefined} onClick={() => setBookingProvider(provider)}>{provider.isFallback ? 'Unavailable' : 'Book provider'}</button>)}
            </div>
          </section>
        )}
      </main>

      {bookingProvider && <BookingModal provider={bookingProvider} onClose={() => setBookingProvider(null)} urgent={urgent} />}
    </>
  )
}
