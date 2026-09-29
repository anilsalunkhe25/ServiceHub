import { useState } from 'react'
import { ArrowRight, ChevronDown, MapPin, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function SearchPanel() {
  const [city, setCity] = useState('Pune')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  return (
    <div className="search-panel">
      <div className="search-field">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What service do you need?" />
      </div>

      <div className="city-field">
        <MapPin size={19} />
        <select value={city} onChange={(event) => setCity(event.target.value)}>
          <option>Pune</option>
          <option>Mumbai</option>
          <option>Kolhapur</option>
          <option>Bengaluru</option>
          <option>Hyderabad</option>
        </select>
        <ChevronDown size={17} />
      </div>

      <button className="search-button" onClick={() => navigate(`/services?search=${encodeURIComponent(query)}&city=${city}`)}>
        Find a pro <ArrowRight size={18} />
      </button>
    </div>
  )
}
