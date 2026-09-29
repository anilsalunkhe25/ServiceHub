import jwt, { type SignOptions } from 'jsonwebtoken'
import { Schema, model } from 'mongoose'

export const jwtSecret = process.env.JWT_SECRET ?? 'development-secret'

export type AuthUser = {
  id: string
  name: string
  email: string
  phone?: string
  password: string
  role: string
  city?: string
}

export type DemoBooking = {
  _id: string
  customerId?: string
  providerId?: string
  providerBusinessName?: string
  service: string
  date: string
  time: string
  address: string
  description?: string
  amount?: number
  paymentMethod?: 'cash_on_delivery' | 'upi'
  urgent?: boolean
  bookingStatus: string
  paymentStatus?: string
  messages?: { senderId: string; senderRole: string; message: string; createdAt: string }[]
  complaint?: { message: string; providerBusinessName?: string; status: string; createdAt: string }
  review?: {
    rating: number
    comment: string
  }
}

export type DemoProvider = {
  _id?: string
  userId?: string
  businessName: string
  description?: string
  category: string
  city: string
  address?: string
  experience?: number
  pricing?: string
  skills?: string[]
  serviceAreas?: string[]
  workingHours?: { days: string[]; start: string; end: string }
  pricingDetails?: string
  portfolioImages?: string[]
  isAvailable?: boolean
  rating: number
  totalReviews: number
  isVerified?: boolean
  isActive?: boolean
}

export type DemoWithdrawal = {
  _id: string
  providerId: string
  amount: number
  payoutUpiId: string
  status: string
  createdAt: string
}

export const userSchema = new Schema({
  name: { 
    type: String, 
    required: true 
},
  email: { 
    type: String, 
    required: true, 
    unique: true 
},
  phone: String,
  password: {
    type: String,
    required: true,
    select: false,
  },
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin'],
    default: 'customer',
  },
  city: String,
}, { timestamps: true })

export const providerSchema = new Schema({
  userId: Schema.Types.ObjectId,
  businessName: String,
  description: String,
  category: String,
  city: String,
  address: String,
  experience: Number,
  pricing: String,
  skills: [String],
  serviceAreas: [String],
  workingHours: { days: [String], start: String, end: String },
  pricingDetails: String,
  portfolioImages: [String],
  isAvailable: { type: Boolean, default: true },
  rating: {
    type: Number,
    default: 0,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true })

export const bookingSchema = new Schema({
  customerId: Schema.Types.Mixed,
  providerId: Schema.Types.Mixed,
  providerBusinessName: String,
  service: String,
  date: String,
  time: String,
  address: String,
  description: String,
  amount: Number,
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'upi'], default: 'cash_on_delivery' },
  urgent: { type: Boolean, default: false },
  paymentStatus: {
    type: String,
    default: 'pending',
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'on_the_way', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  messages: [{ senderId: String, senderRole: String, message: String, createdAt: String }],
  complaint: { message: String, providerBusinessName: String, status: { type: String, default: 'open' }, createdAt: String },
  review: {
    rating: Number,
    comment: String,
  },
}, { timestamps: true })

export const withdrawalSchema = new Schema({
  providerId: Schema.Types.Mixed,
  amount: { type: Number, required: true, min: 1 },
  payoutUpiId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
}, { timestamps: true })

export const User = model('User', userSchema)
export const Provider = model('Provider', providerSchema)
export const Booking = model('Booking', bookingSchema)
export const Withdrawal = model('Withdrawal', withdrawalSchema)

export const demoUsers: AuthUser[] = []
export const demoBookings: DemoBooking[] = []
export const demoProviderServices: DemoProvider[] = []
export const demoWithdrawals: DemoWithdrawal[] = []

export const demoProviders: DemoProvider[] = [
  { _id: 'fixright', businessName: 'FixRight Services', category: 'Home repair', city: 'Pune', rating: 4.9, totalReviews: 128, pricing: 'From ₹499', isVerified: true },
  { _id: 'urbanglow', businessName: 'Urban Glow Studio', category: 'Wellness', city: 'Mumbai', rating: 4.8, totalReviews: 94, pricing: 'From ₹699', isVerified: true },
  { _id: 'motocraft', businessName: 'MotoCraft Garage', category: 'Auto care', city: 'Kolhapur', rating: 4.9, totalReviews: 76, pricing: 'From ₹299', isVerified: true },
  { _id: 'brightwire', businessName: 'BrightWire Electricians', category: 'Electrician', city: 'Pune', rating: 4.8, totalReviews: 61, pricing: 'From ₹399', isVerified: true },
  { _id: 'framesandlight', businessName: 'Frames & Light Photography', category: 'Photographer', city: 'Mumbai', rating: 4.9, totalReviews: 47, pricing: 'From ₹1,999', isVerified: true },
  { _id: 'trimandtone', businessName: 'Trim & Tone Saloon', category: 'Saloon', city: 'Bengaluru', rating: 4.7, totalReviews: 83, pricing: 'From ₹299', isVerified: true },
  { _id: 'dailybasket', businessName: 'Daily Basket Grocery', category: 'Grocery', city: 'Hyderabad', rating: 4.8, totalReviews: 112, pricing: 'From ₹99', isVerified: true },
  { _id: 'powerpoint', businessName: 'PowerPoint Electrical Services', category: 'Electrical services', city: 'Kolhapur', rating: 4.8, totalReviews: 58, pricing: 'From ₹449', isVerified: true },
]

export let databaseReady = false

export function setDatabaseReady(value: boolean) {
  databaseReady = value
}

export function tokenFor(user: { id: string; role: string }) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
  }

  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, options)
}
