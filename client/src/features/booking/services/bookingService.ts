import { createBooking, getMyBookings, getProviderBookings, getCustomerDetails, updateBookingStatus, submitReview } from '../../../api'
import type { BookingRequestPayload, BookingRecord } from '../types/booking'

export async function createBookingRequest(payload: BookingRequestPayload) {
  return createBooking(payload)
}

export async function fetchMyBookings() {
  return getMyBookings()
}

export async function fetchProviderBookings() {
  return getProviderBookings()
}

export async function fetchCustomerDetails(bookingId: string) {
  return getCustomerDetails(bookingId)
}

export async function changeBookingStatus(booking: BookingRecord, status: BookingRecord['bookingStatus']) {
  return updateBookingStatus(booking._id, booking.bookingStatus, status, booking.providerId)
}

export async function sendBookingReview(bookingId: string, rating: number, comment: string) {
  return submitReview(bookingId, rating, comment)
}
