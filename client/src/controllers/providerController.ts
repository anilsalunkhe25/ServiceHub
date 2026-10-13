import {
  createBooking,
  deleteMyService,
  getCustomerDetails,
  getMyBookings,
  getMyService,
  getProvider,
  getProviderBookings,
  getProviders,
  saveMyService,
  submitReview,
  updateBookingStatus,
  updateCashPaymentStatus,
  updateMyService,
} from '../api'
import type { Booking, PaymentMethod, Provider as ApiProvider, ProviderServicePayload } from '../api'

export async function fetchProviders(params: { search?: string; city?: string; category?: string; area?: string }) {
  return getProviders(params)
}

export async function fetchProviderById(id: string) {
  return getProvider(id)
}

export async function fetchMyService() {
  try {
    return await getMyService()
  } catch {
    const saved = localStorage.getItem('servicehub_my_service')
    return saved ? (JSON.parse(saved) as ApiProvider) : null
  }
}

export async function persistService(form: ProviderServicePayload, isEditing: boolean) {
  const service = isEditing ? await updateMyService(form) : await saveMyService(form)
  localStorage.setItem('servicehub_my_service', JSON.stringify(service))
  return service
}

export async function removeService() {
  await deleteMyService()
  localStorage.removeItem('servicehub_my_service')
}

export async function createBookingRequest(payload: {
  providerId: string;
  service: string;
  date: string;
  time: string;
  address: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  packageId?: string;
  urgent?: boolean
}) {
  return createBooking(payload)
}

export async function loadMyBookings() {
  return getMyBookings()
}

export async function loadProviderBookings() {
  return getProviderBookings()
}

export async function loadCustomerDetails(bookingId: string) {
  return getCustomerDetails(bookingId)
}

export async function changeBookingStatus(booking: Booking, status: Booking['bookingStatus']) {
  return updateBookingStatus(booking._id, booking.bookingStatus, status, booking.providerId)
}

export async function changeCashPaymentStatus(booking: Booking, paymentStatus: 'pending' | 'paid') {
  return updateCashPaymentStatus(booking._id, paymentStatus)
}

export async function sendReview(bookingId: string, rating: number, comment: string) {
  return submitReview(bookingId, rating, comment)
}

export function getErrorMessage(reason: unknown) {
  const message = (reason as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || 'Unable to connect. Please try again.'
}
