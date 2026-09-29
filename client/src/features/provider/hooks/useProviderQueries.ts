import { useEffect, useState } from 'react'
import { fetchProviders } from '../services/providerService'
import type { ProviderListItem } from '../types/provider'

export function useProviderQueries(params: { search?: string; city?: string; category?: string }) {
  const [items, setItems] = useState<ProviderListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    fetchProviders(params)
      .then((result) => setItems(result))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [params.search, params.city, params.category])

  return { items, loading }
}
