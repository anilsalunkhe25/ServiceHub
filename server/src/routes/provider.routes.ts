import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { Booking, Provider, Withdrawal, demoProviders, demoProviderServices, demoWithdrawals, databaseReady } from '../config/appState.js'
import type { DemoProvider, DemoWithdrawal } from '../config/appState.js'
import { formatStartingPrice, normalizeServicePackages } from '../utils/paymentHelpers.js'

const router = Router()

const categoryVariants: Record<string, string[]> = {
  'home repair': ['Home repair', 'Electrician', 'Electrical services', 'Home service', 'Home services'],
  cleaning: ['Cleaning', 'Cleaning service', 'Cleaning services'],
  'auto care': ['Auto care', 'Auto care services', 'Autocare'],
}

function matchingCategories(value: string) {
  const normalized = value.trim().toLocaleLowerCase()
  return categoryVariants[normalized] || [value.trim()]
}

function availableEarnings(completedBookings: { amount?: number | null }[], withdrawals: { amount: number; status: string }[]) {
  const earned = completedBookings.reduce((total, booking) => total + (booking.amount || 0), 0)
  const reserved = withdrawals.filter(
    (request) => ['pending', 'approved', 'paid'].includes(request.status))
    .reduce((total, request) => total + request.amount, 0)
  
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
    const { businessName, category, description, city, address, pricing, experience, packages: packageInput, skills = [], serviceAreas = [], workingHours, pricingDetails = '', profileImage = '', portfolioImages = [], isAvailable = true } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
    }
    if (experience !== undefined && (!Number.isInteger(Number(experience)) || Number(experience) < 0 || Number(experience) > 80)) {
      return response.status(400).json({ success: false, message: 'Experience must be a whole number between 0 and 80 years' })
    }

    if (!Array.isArray(skills) || !Array.isArray(serviceAreas) || !Array.isArray(portfolioImages) || portfolioImages.length > 6 || portfolioImages.some((image: unknown) => typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 650000)) {
      return response.status(400).json({ success: false, message: 'Use valid skills, service areas, and up to 6 compressed images' })
    }
    if (typeof profileImage !== 'string' || (profileImage && (!/^data:image\/jpeg;base64,[A-Za-z\d+/]+=*$/.test(profileImage) || profileImage.length > 650000))) {
      return response.status(400).json({ success: false, message: 'Choose a valid compressed JPEG profile picture under 500 KB' })
    }

    const packages = normalizeServicePackages(packageInput)
    if (!packages) return response.status(400).json({ success: false, message: 'Packages must have unique IDs, names, prices and up to 10 features each' })
    const startingPrice = packages.length
      ? `From ₹${(Math.min(...packages.map((item) => item.pricePaise)) / 100).toLocaleString('en-IN')}`
      : formatStartingPrice(pricing)

    if (!databaseReady) {
      const existing = demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)
      const service = {
        ...(existing || { _id: request.user?.id, userId: request.user?.id, rating: 0, totalReviews: 0, isVerified: false, isActive: true }),
        businessName,
        category,
        description,
        city,
        address,
        pricing: startingPrice,
        experience: experience === undefined ? existing?.experience : Number(experience),
        packages,
        skills,
        serviceAreas,
        workingHours,
        pricingDetails,
        profileImage,
        portfolioImages,
        isAvailable,
      }

      if (existing) Object.assign(existing, service)
      else demoProviderServices.push(service)

      return response.json({ success: true, message: 'Service listing saved', data: service })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing: startingPrice, experience: experience === undefined ? 0 : Number(experience), packages, skills, serviceAreas, workingHours, pricingDetails, profileImage, portfolioImages, isAvailable, isActive: true },
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
    const { businessName, category, description, city, address, pricing, experience, packages: packageInput, skills = [], serviceAreas = [], workingHours, pricingDetails = '', profileImage = '', portfolioImages = [], isAvailable = true } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
    }
    if (experience !== undefined && (!Number.isInteger(Number(experience)) || Number(experience) < 0 || Number(experience) > 80)) {
      return response.status(400).json({ success: false, message: 'Experience must be a whole number between 0 and 80 years' })
    }

    if (!Array.isArray(skills) || !Array.isArray(serviceAreas) || !Array.isArray(portfolioImages) || portfolioImages.length > 6 || portfolioImages.some((image: unknown) => typeof image !== 'string' || !image.startsWith('data:image/') || image.length > 650000)) {
      return response.status(400).json({ success: false, message: 'Use valid skills, service areas, and up to 6 compressed images' })
    }
    if (typeof profileImage !== 'string' || (profileImage && (!/^data:image\/jpeg;base64,[A-Za-z\d+/]+=*$/.test(profileImage) || profileImage.length > 650000))) {
      return response.status(400).json({ success: false, message: 'Choose a valid compressed JPEG profile picture under 500 KB' })
    }

    const packages = normalizeServicePackages(packageInput)
    if (!packages) return response.status(400).json({ success: false, message: 'Packages must have unique IDs, names, prices and up to 10 features each' })
    const startingPrice = packages.length
      ? `From ₹${(Math.min(...packages.map((item) => item.pricePaise)) / 100).toLocaleString('en-IN')}`
      : formatStartingPrice(pricing)

    if (!databaseReady) {
      const existing = demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)
      if (!existing) {
        return response.status(404).json({ success: false, message: 'Service not found' })
      }

      Object.assign(existing, { businessName, category, description, city, address, pricing: startingPrice, packages, experience, skills, serviceAreas, workingHours, pricingDetails, profileImage, portfolioImages, isAvailable })
      return response.json({ success: true, message: 'Service updated successfully', data: existing })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing: startingPrice, packages, experience, skills, serviceAreas, workingHours, pricingDetails, profileImage, portfolioImages, isAvailable },
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
    const clauses: Record<string, unknown>[] = [{
      businessName: { $exists: true, $ne: '' },
      category: { $exists: true, $ne: '' },
      city: { $exists: true, $ne: '' },
      isAvailable: { $ne: false },
    }]
    if (request.query.city) clauses.push({ city: request.query.city })
    const requestedCategory = request.query.category ? String(request.query.category) : ''
    const categoryValues = requestedCategory ? matchingCategories(requestedCategory) : []
    if (categoryValues.length) clauses.push({ category: { $in: categoryValues } })
    if (request.query.search) clauses.push({
      $or: [
        { businessName: { $regex: request.query.search, $options: 'i' } },
        { category: { $regex: request.query.search, $options: 'i' } },
        { description: { $regex: request.query.search, $options: 'i' } },
        { skills: { $regex: request.query.search, $options: 'i' } },
      ]
    })
    if (request.query.area) clauses.push({
      $or: [
        { city: { $regex: request.query.area, $options: 'i' } },
        { serviceAreas: { $regex: request.query.area, $options: 'i' } },
      ]
    })

    if (!databaseReady) {
      const allProviders = [...demoProviders, ...demoProviderServices]

      const results = allProviders.filter((provider: DemoProvider) =>
        provider.isAvailable !== false &&
        (!request.query.city || provider.city === request.query.city) &&
        (!categoryValues.length || categoryValues.includes(provider.category)) &&
        (!request.query.area || [provider.city, ...(provider.serviceAreas || [])].some((value) => String(value).toLowerCase().includes(String(request.query.area).toLowerCase()))) &&
        (!request.query.search || [provider.businessName, provider.category, provider.description, ...(provider.skills || [])].some((value) => String(value || '').toLowerCase().includes(String(request.query.search).toLowerCase()))),
      )
      const bookings = (await import('../config/appState.js')).demoBookings
      const data = results.map((provider) => {
        const providerBookings = bookings.filter((booking) => booking.providerId === provider._id)
        const responded = providerBookings.filter((booking) => !['pending', 'cancelled'].includes(booking.bookingStatus)).length
        return { ...provider, completedJobs: providerBookings.filter((booking) => booking.bookingStatus === 'completed').length, responseRate: providerBookings.length ? Math.round(responded / providerBookings.length * 100) : null }
      })
      return response.json({ success: true, data })
    }

    const results = await Provider.find({ $and: clauses }).sort({ updatedAt: -1 }).limit(50)
    const providerIds = results.map((provider) => provider._id)
    const bookings = providerIds.length ? await Booking.find({ providerId: { $in: providerIds } }).select('providerId bookingStatus').lean() : []
    const grouped = new Map<string, { completed: number; total: number; responded: number }>()
    for (const booking of bookings) {
      const key = String(booking.providerId)
      const stats = grouped.get(key) || { completed: 0, total: 0, responded: 0 }
      stats.total += 1
      if (booking.bookingStatus === 'completed') stats.completed += 1
      if (!['pending', 'cancelled'].includes(booking.bookingStatus)) stats.responded += 1
      grouped.set(key, stats)
    }
    const data = results.map((provider) => {
      const stats = grouped.get(String(provider._id))
      return { ...provider.toObject(), completedJobs: stats?.completed || 0, responseRate: stats?.total ? Math.round(stats.responded / stats.total * 100) : null }
    })
    response.json({ success: true, data })
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
