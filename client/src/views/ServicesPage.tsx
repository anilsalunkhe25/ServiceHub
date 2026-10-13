import { useEffect, useState } from 'react'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import type { Provider as ApiProvider } from '../api'
import { Navigation } from '../components/Navigation'
import { ProviderCard } from '../components/ProviderCard'
import { categories, canonicalCategory, providerMatchesCategory } from '../data/serviceCategories'
import { fetchProviders } from '../controllers/providerController'
import { BookingModal } from './BookingModal'
import { matchProviders } from '../features/provider/matching'
import { bookingTimes, getLocalDate, isPastBookingTime } from '../features/provider/schedule'

export function ServicesPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [search, setSearch] = useState(params.get('search') || '')
  const [city, setCity] = useState(params.get('city') || '')
  const [category, setCategory] = useState(canonicalCategory(params.get('category') || ''))
  const [area, setArea] = useState(params.get('area') || '')
  const [maxBudget, setMaxBudget] = useState('')
  const [requiredDate, setRequiredDate] = useState('')
  const [requiredTime, setRequiredTime] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [items, setItems] = useState<ApiProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [bookingProvider, setBookingProvider] = useState<ApiProvider | null>(null)
  const [comparison, setComparison] = useState<ApiProvider[]>([])
  const urgent = params.get('urgent') === 'true'

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const toggleCompare = (provider: ApiProvider) => {
    const key = provider._id || provider.businessName
    setComparison((current) => current.some((item) => (item._id || item.businessName) === key)
      ? current.filter((item) => (item._id || item.businessName) !== key)
      : current.length < 3 && (!current.length || providerMatchesCategory(current[0].category, provider.category)) ? [...current, provider] : current)
  }

  useEffect(() => {
    setLoading(true)

    fetchProviders({ search, city, category, area }).then((result) => {
      const saved = JSON.parse(localStorage.getItem('servicehub_my_service') || 'null') as ApiProvider | null
      const localMatch = saved && (!search || [saved.businessName, saved.category, saved.description, ...(saved.skills || [])].some((value) => (value || '').toLowerCase().includes(search.toLowerCase()))) && (!city || saved.city === city) && (!category || providerMatchesCategory(saved.category, category)) && (!area || [saved.city, ...(saved.serviceAreas || [])].some((value) => value.toLowerCase().includes(area.toLowerCase())))
        ? [saved]
        : []

      const providers = [...localMatch, ...result.filter((provider) => provider._id !== saved?._id)]
      setItems(providers)
    }).catch(() => setItems([])).finally(() => setLoading(false))
  }, [search, city, category, area])

  const ranked = matchProviders(items, {
    search,
    city,
    area,
    category,
    maxBudget: maxBudget ? Number(maxBudget) : null,
    date: requiredDate,
    time: requiredTime,
  })

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
              <select value={category} onChange={(event) => { setCategory(event.target.value); setComparison([]) }}>
                <option value="">All categories</option>
                {categories.map(({ name }) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>
              Neighborhood or area
              <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Kothrud" />
            </label>
            <label>
              Maximum budget (₹)
              <input type="number" min="1" value={maxBudget} onChange={(event) => setMaxBudget(event.target.value)} placeholder="Any budget" />
            </label>
            <label>
              Required date
              <input type="date" min={getLocalDate(now)} value={requiredDate} onChange={(event) => {
                const date = event.target.value
                setRequiredDate(date)
                if (isPastBookingTime(date, requiredTime, new Date())) setRequiredTime('')
              }} />
            </label>
            <label>
              Required time
              <select value={requiredTime} onChange={(event) => setRequiredTime(event.target.value)}>
                <option value="">Any time</option>
                {bookingTimes.map((time) => <option key={time} disabled={isPastBookingTime(requiredDate, time, now)}>{time}</option>)}
              </select>
            </label>
          </aside>

          <section className="results">
            <div className="results-toolbar">
              <strong>{loading ? 'Searching...' : `${ranked.length} best matches`}</strong>
              <div>
                <span>{comparison.length ? `${comparison.length} of 3 selected` : 'Compare up to 3 providers in one category'}</span>
                <button onClick={() => { setSearch(''); setCity(''); setCategory(''); setArea(''); setMaxBudget(''); setRequiredDate(''); setRequiredTime('') }}>Clear filters</button>
              </div>
            </div>
            {!loading && <p className="match-explanation">Ranked by service fit, listed area, schedule, budget and provider track record. Area coverage uses the provider's service area; GPS distance is not collected.</p>}

            {loading ? (
              <LoaderCircle className="loader" />
            ) : (
              <div className="provider-grid">
                {ranked.length ? ranked.map(({ provider, score, reasons }) => (
                  <ProviderCard provider={provider} matchScore={score} matchReasons={reasons} onBook={setBookingProvider} onCompare={toggleCompare} compared={comparison.some((item) => (item._id || item.businessName) === (provider._id || provider.businessName))} compareDisabled={comparison.length >= 3 || (comparison.length > 0 && !providerMatchesCategory(comparison[0].category, provider.category))} key={provider._id || provider.businessName} />
                )) : <div className="empty-state match-empty-state"><h3>No matching service providers yet</h3><p>Try another category or check back after providers publish their listings.</p><button onClick={() => { setMaxBudget(''); setRequiredDate(''); setRequiredTime('') }}>Clear budget and schedule</button></div>}
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

      {bookingProvider && <BookingModal provider={bookingProvider} onClose={() => setBookingProvider(null)} urgent={urgent} initialDate={requiredDate} initialTime={requiredTime} />}
    </>
  )
}
