import { useEffect, useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
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
          <p className="kicker">Your local shortlist</p>
          <h1>Find a pro for <em>anything.</em></h1>
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
              <button onClick={() => { setSearch(''); setCity(''); setCategory('') }}>Clear filters</button>
            </div>

            {loading ? (
              <LoaderCircle className="loader" />
            ) : (
              <div className="provider-grid">
                {items.map((provider) => (
                  <ProviderCard provider={provider} onBook={setBookingProvider} key={provider._id || provider.businessName} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {bookingProvider && <BookingModal provider={bookingProvider} onClose={() => setBookingProvider(null)} />}
    </>
  )
}
