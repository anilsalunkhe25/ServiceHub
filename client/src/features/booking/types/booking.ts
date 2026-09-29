import type { Booking as ApiBooking } from '../../../api'

export type BookingRequestPayload = {
  providerId: string
  service: string
  date: string
  time: string
  address: string
  description: string
  amount: number
}

export type BookingRecord = ApiBooking
