import { useEffect, useState } from 'react'
import type { Booking } from '../../../api'
import { loadCustomerDashboardBookings, loadProviderDashboardBookings } from '../services/dashboardService'

export function useDashboardData(role: 'customer' | 'provider') {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)

    const loader = role === 'provider' ? loadProviderDashboardBookings : loadCustomerDashboardBookings

    loader()
      .then(setBookings)
      .catch(() => setError('Unable to load booking requests.'))
      .finally(() => setLoading(false))
  }, [role])

  return { bookings, loading, error, setBookings }
}
