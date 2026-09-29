import type { Booking as ApiBooking, PaymentMethod } from '../../../api'

export type BookingRequestPayload = {
  providerId: string
  service: string
  date: string
  time: string
  address: string
  description: string
  amount: number
  paymentMethod: PaymentMethod
}

export type BookingRecord = ApiBooking
