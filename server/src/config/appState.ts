import jwt, { type SignOptions } from 'jsonwebtoken'
import { Schema, model, type InferSchemaType } from 'mongoose'

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
  paymentMethod?: 'cash_on_delivery' | 'upi' | 'online'
  servicePackageId?: string
  servicePackageName?: string
  urgent?: boolean
  bookingStatus: string
  paymentStatus?: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
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
  packages?: ServicePackage[]
  skills?: string[]
  serviceAreas?: string[]
  workingHours?: { days: string[]; start: string; end: string }
  pricingDetails?: string
  profileImage?: string
  portfolioImages?: string[]
  isAvailable?: boolean
  rating: number
  totalReviews: number
  isVerified?: boolean
  isActive?: boolean
}

export type ServicePackage = {
  id: string
  name: string
  features: string[]
  pricePaise: number
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
  packages: [{
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 60 },
    features: { type: [String], default: [], validate: (items: string[]) => items.length <= 10 },
    pricePaise: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER },
  }],
  skills: [String],
  serviceAreas: [String],
  workingHours: { days: [String], start: String, end: String },
  pricingDetails: String,
  profileImage: String,
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
  servicePackageId: String,
  servicePackageName: String,
  paymentMethod: { type: String, enum: ['cash_on_delivery', 'upi', 'online'], default: 'cash_on_delivery' },
  urgent: { type: Boolean, default: false },
  paymentStatus: {
    type: String,
    enum: ['pending', 'created', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  razorpayOrderId: String,
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', unique: true, sparse: true },
  currency: { type: String, default: 'INR' },
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

const paymentBookingDetailsSchema = new Schema({
  service: { type: String, required: true },
  packageId: String,
  packageName: String,
  providerBusinessName: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  description: { type: String, default: '' },
  urgent: { type: Boolean, default: false },
}, { _id: false })

const paymentAttemptSchema = new Schema({
  orderId: { type: String, required: true },
  paymentId: String,
  status: { type: String, enum: ['created', 'failed', 'paid'], default: 'created' },
  method: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: false })

const paymentRefundSchema = new Schema({
  requestId: { type: String, required: true },
  razorpayRefundId: String,
  amountPaise: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true },
  status: { type: String, enum: ['created', 'processed', 'failed'], default: 'created' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false })

export const paymentSchema = new Schema({
  customerId: { type: Schema.Types.Mixed, required: true },
  providerId: { type: Schema.Types.Mixed, required: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  bookingDetails: { type: paymentBookingDetailsSchema, required: true },
  amountPaise: { type: Number, required: true, min: 1 },
  taxPaise: { type: Number, default: 0, min: 0 },
  feePaise: { type: Number, default: 0, min: 0 },
  currency: { type: String, required: true, default: 'INR' },
  gateway: { type: String, enum: ['razorpay'], default: 'razorpay' },
  razorpayOrderId: { type: String, unique: true, sparse: true },
  razorpayPaymentId: { type: String, unique: true, sparse: true },
  paymentMethod: String,
  status: { type: String, enum: ['pending', 'created', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
  idempotencyKey: { type: String, required: true },
  bookingKey: { type: String, unique: true, sparse: true },
  attempts: { type: [paymentAttemptSchema], default: [] },
  refunds: { type: [paymentRefundSchema], default: [] },
  processedWebhookEventIds: { type: [String], default: [] },
  orderCreationLock: String,
  orderCreationLockAt: Date,
  refundLock: String,
  refundLockAt: Date,
}, { timestamps: true })

paymentSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true })
paymentSchema.index({ customerId: 1, createdAt: -1 })
paymentSchema.index({ providerId: 1, createdAt: -1 })
paymentSchema.index({ 'attempts.orderId': 1 })
export type PaymentRecord = InferSchemaType<typeof paymentSchema>

export const withdrawalSchema = new Schema({
  providerId: Schema.Types.Mixed,
  amount: { type: Number, required: true, min: 1 },
  payoutUpiId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
}, { timestamps: true })

export const User = model('User', userSchema)
export const Provider = model('Provider', providerSchema)
export const Booking = model('Booking', bookingSchema)
export const Payment = model<PaymentRecord>('Payment', paymentSchema)
export const Withdrawal = model('Withdrawal', withdrawalSchema)

export const demoUsers: AuthUser[] = []
export const demoBookings: DemoBooking[] = []
export const demoProviderServices: DemoProvider[] = []
export const demoWithdrawals: DemoWithdrawal[] = []

export const demoProviders: DemoProvider[] = []

export let databaseReady = false

export function setDatabaseReady(value: boolean) {
  databaseReady = value
}

export function tokenFor(user: { id: string; role: string }) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7h') as SignOptions['expiresIn'],
  }

  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, options)
}
