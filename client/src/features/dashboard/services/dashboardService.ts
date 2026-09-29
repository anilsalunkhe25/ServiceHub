import { getMyBookings, getProviderBookings } from '../../../api'

export async function loadCustomerDashboardBookings() {
  return getMyBookings()
}

export async function loadProviderDashboardBookings() {
  return getProviderBookings()
}
