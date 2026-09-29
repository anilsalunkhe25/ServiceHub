import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { Booking, Provider, Withdrawal, demoProviders, demoProviderServices, demoWithdrawals, databaseReady } from '../config/appState.js'
import type { DemoProvider, DemoWithdrawal } from '../config/appState.js'

const router = Router()

function availableEarnings(completedBookings: { amount?: number | null }[], withdrawals: { amount: number; status: string }[]) {
  const earned = completedBookings.reduce((total, booking) => total + (booking.amount || 0), 0)
  const reserved = withdrawals.filter((request) => ['pending', 'approved', 'paid'].includes(request.status)).reduce((total, request) => total + request.amount, 0)
  return Math.max(0, earned - reserved)
}

router.get('/withdrawals', auth('provider'), async (request, response, next) => {
  try {
    if (!databaseReady) {
      const provider = demoProviderServices.find((item) => item.userId === request.user?.id)
      const providerId = provider?._id || request.user?.id || ''
      const completedBookings = (await import('../config/appState.js')).demoBookings.filter((booking) => booking.providerId === providerId && booking.bookingStatus === 'completed')
      const withdrawals = demoWithdrawals.filter((item) => item.providerId === providerId)
      return response.json({ success: true, data: { availableAmount: availableEarnings(completedBookings, withdrawals), withdrawals } })
    }

    const provider = await Provider.findOne({ userId: request.user?.id })
    if (!provider) return response.status(404).json({ success: false, message: 'Provider service not found' })
    const [completedBookings, withdrawals] = await Promise.all([
      Booking.find({ providerId: provider._id, bookingStatus: 'completed' }),
      Withdrawal.find({ providerId: provider._id }),
    ])
    response.json({ success: true, data: { availableAmount: availableEarnings(completedBookings, withdrawals), withdrawals } })
  } catch (error) {
    next(error)
  }
})

router.post('/withdrawals', auth('provider'), async (request, response, next) => {
  try {
    const amount = Number(request.body.amount)
    const payoutUpiId = String(request.body.payoutUpiId || '').trim()
    if (!Number.isFinite(amount) || amount <= 0) return response.status(400).json({ success: false, message: 'Enter a valid withdrawal amount' })
    if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(payoutUpiId)) return response.status(400).json({ success: false, message: 'Enter a valid UPI ID' })

    if (!databaseReady) {
      const provider = demoProviderServices.find((item) => item.userId === request.user?.id)
      const providerId = provider?._id || request.user?.id || ''
      const completedBookings = (await import('../config/appState.js')).demoBookings.filter((booking) => booking.providerId === providerId && booking.bookingStatus === 'completed')
      const withdrawals = demoWithdrawals.filter((item) => item.providerId === providerId)
      const availableAmount = availableEarnings(completedBookings, withdrawals)
      if (amount > availableAmount) return response.status(400).json({ success: false, message: `Amount exceeds available balance of ₹${availableAmount}` })
      const withdrawal: DemoWithdrawal = { _id: `demo-withdrawal-${Date.now()}`, providerId, amount, payoutUpiId, status: 'pending', createdAt: new Date().toISOString() }
      demoWithdrawals.unshift(withdrawal)
      return response.status(201).json({ success: true, message: 'Withdrawal request recorded', data: { availableAmount: availableAmount - amount, withdrawal } })
    }

    const provider = await Provider.findOne({ userId: request.user?.id })
    if (!provider) return response.status(404).json({ success: false, message: 'Provider service not found' })
    const [completedBookings, withdrawals] = await Promise.all([
      Booking.find({ providerId: provider._id, bookingStatus: 'completed' }),
      Withdrawal.find({ providerId: provider._id }),
    ])
    const availableAmount = availableEarnings(completedBookings, withdrawals)
    if (amount > availableAmount) return response.status(400).json({ success: false, message: `Amount exceeds available balance of ₹${availableAmount}` })
    const withdrawal = await Withdrawal.create({ providerId: provider._id, amount, payoutUpiId })
    response.status(201).json({ success: true, message: 'Withdrawal request recorded', data: { availableAmount: availableAmount - amount, withdrawal } })
  } catch (error) {
    next(error)
  }
})

router.post('/me', auth('provider'), async (request, response, next) => {
  try {
    const { businessName, category, description, city, address, pricing, skills = [], serviceAreas = [], workingHours, pricingDetails = '', portfolioImages = [], isAvailable = true } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
    }

    if (!Array.isArray(skills) || !Array.isArray(serviceAreas) || !Array.isArray(portfolioImages) || portfolioImages.length > 6 || portfolioImages.some((image: unknown) => typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 650000)) {
      return response.status(400).json({ success: false, message: 'Use valid skills, service areas, and up to 6 compressed images' })
    }

    if (!databaseReady) {
      const existing = demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)
      const service = {
        ...(existing || { _id: request.user?.id, userId: request.user?.id, rating: 0, totalReviews: 0, isVerified: false, isActive: true }),
        businessName,
        category,
        description,
        city,
        address,
        pricing,
        skills,
        serviceAreas,
        workingHours,
        pricingDetails,
        portfolioImages,
        isAvailable,
      }

      if (existing) Object.assign(existing, service)
      else demoProviderServices.push(service)

      return response.json({ success: true, message: 'Service listing saved', data: service })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing, skills, serviceAreas, workingHours, pricingDetails, portfolioImages, isAvailable, isActive: true },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    response.json({ success: true, message: 'Service listing saved', data: service })
  } catch (error) {
    next(error)
  }
})

router.get('/me', auth('provider'), async (request, response, next) => {
  try {
    const service = databaseReady
      ? await Provider.findOne({
        userId: request.user?.id,
        businessName: { $exists: true, $ne: '' },
        category: { $exists: true, $ne: '' },
        city: { $exists: true, $ne: '' },
      })
      : demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)

    response.json({ success: true, data: service || null })
  } catch (error) {
    next(error)
  }
})

router.put('/me', auth('provider'), async (request, response, next) => {
  try {
    const { businessName, category, description, city, address, pricing, experience, skills = [], serviceAreas = [], workingHours, pricingDetails = '', portfolioImages = [], isAvailable = true } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
    }

    if (!Array.isArray(skills) || !Array.isArray(serviceAreas) || !Array.isArray(portfolioImages) || portfolioImages.length > 6 || portfolioImages.some((image: unknown) => typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 650000)) {
      return response.status(400).json({ success: false, message: 'Use valid skills, service areas, and up to 6 compressed images' })
    }

    if (!databaseReady) {
      const existing = demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)
      if (!existing) {
        return response.status(404).json({ success: false, message: 'Service not found' })
      }

      Object.assign(existing, { businessName, category, description, city, address, pricing, experience, skills, serviceAreas, workingHours, pricingDetails, portfolioImages, isAvailable })
      return response.json({ success: true, message: 'Service updated successfully', data: existing })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing, experience, skills, serviceAreas, workingHours, pricingDetails, portfolioImages, isAvailable },
      { new: true },
    )

    if (!service) {
      return response.status(404).json({ success: false, message: 'Service not found' })
    }

    response.json({ success: true, message: 'Service updated successfully', data: service })
  } catch (error) {
    next(error)
  }
})

router.delete('/me', auth('provider'), async (request, response, next) => {
  try {
    if (!databaseReady) {
      const index = demoProviderServices.findIndex((item: DemoProvider) => item.userId === request.user?.id)

      if (index === -1) {
        return response.status(404).json({ success: false, message: 'Service not found' })
      }

      const deleted = demoProviderServices.splice(index, 1)
      return response.json({ success: true, message: 'Service deleted successfully', data: deleted[0] })
    }

    const deleted = await Provider.findOneAndDelete({ userId: request.user?.id })

    if (!deleted) {
      return response.status(404).json({ success: false, message: 'Service not found' })
    }

    response.json({ success: true, message: 'Service deleted successfully', data: deleted })
  } catch (error) {
    next(error)
  }
})

router.get('/', async (request, response, next) => {
  try {
    const filter: Record<string, unknown> = {
      businessName: { $exists: true, $ne: '' },
      category: { $exists: true, $ne: '' },
      city: { $exists: true, $ne: '' },
      isAvailable: { $ne: false },
      ...(request.query.city ? { city: request.query.city } : {}),
      ...(request.query.category ? { category: request.query.category } : {}),
      ...(request.query.search ? { $or: [{ businessName: { $regex: request.query.search, $options: 'i' } }, { category: { $regex: request.query.search, $options: 'i' } }] } : {}),
    }

    if (!databaseReady) {
      const allProviders = [...demoProviders, ...demoProviderServices]

      const results = allProviders.filter((provider: DemoProvider) =>
        provider.isAvailable !== false &&
        (!request.query.city || provider.city === request.query.city) &&
        (!request.query.category || provider.category === request.query.category) &&
        (!request.query.search || [provider.businessName, provider.category].some((value) => String(value).toLowerCase().includes(String(request.query.search).toLowerCase()))),
      )

      return response.json({ success: true, data: results })
    }

    const results = await Provider.find(Object.keys(filter).length ? (filter as Record<string, unknown>) : {}).sort({ updatedAt: -1 }).limit(50)
    response.json({ success: true, data: results })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', async (request, response, next) => {
  try {
    const provider = databaseReady
      ? await Provider.findById(request.params.id)
      : [...demoProviders, ...demoProviderServices].find((item: DemoProvider) => item._id === request.params.id)

    if (!provider) {
      return response.status(404).json({ success: false, message: 'Service provider not found' })
    }

    response.json({ success: true, data: provider })
  } catch (error) {
    next(error)
  }
})

export default router
