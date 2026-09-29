import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { Provider, demoProviders, demoProviderServices, databaseReady } from '../config/appState.js'
import type { DemoProvider } from '../config/appState.js'

const router = Router()

router.post('/me', auth('provider'), async (request, response, next) => {
  try {
    const { businessName, category, description, city, address, pricing } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
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
      }

      if (existing) Object.assign(existing, service)
      else demoProviderServices.push(service)

      return response.json({ success: true, message: 'Service listing saved', data: service })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing, isActive: true },
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
      ? await Provider.findOne({ userId: request.user?.id })
      : demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)

    response.json({ success: true, data: service || null })
  } catch (error) {
    next(error)
  }
})

router.put('/me', auth('provider'), async (request, response, next) => {
  try {
    const { businessName, category, description, city, address, pricing, experience } = request.body

    if (!businessName || !category || !city) {
      return response.status(400).json({ success: false, message: 'Business name, service type and city are required' })
    }

    if (!databaseReady) {
      const existing = demoProviderServices.find((item: DemoProvider) => item.userId === request.user?.id)
      if (!existing) {
        return response.status(404).json({ success: false, message: 'Service not found' })
      }

      Object.assign(existing, { businessName, category, description, city, address, pricing, experience })
      return response.json({ success: true, message: 'Service updated successfully', data: existing })
    }

    const service = await Provider.findOneAndUpdate(
      { userId: request.user?.id },
      { businessName, category, description, city, address, pricing, experience },
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
    const filter = {
      ...(request.query.city ? { city: request.query.city } : {}),
      ...(request.query.category ? { category: request.query.category } : {}),
      ...(request.query.search ? { $or: [{ businessName: { $regex: request.query.search, $options: 'i' } }, { category: { $regex: request.query.search, $options: 'i' } }] } : {}),
    }

    if (!databaseReady) {
      const allProviders = [...demoProviders, ...demoProviderServices]

      const results = allProviders.filter((provider: DemoProvider) =>
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
