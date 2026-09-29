import { Router } from 'express'
import { auth } from '../middleware/auth.js'

import {
    Booking,
    Provider,
    User,
    databaseReady,
    demoBookings,
    demoProviders,
    demoProviderServices,
} from '../config/appState.js'
import type { DemoBooking, DemoProvider } from '../config/appState.js'

const router = Router()

router.get('/:bookingId/customer', auth('provider'), async (request, response, next) => {
    try {
        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.bookingId)

            if (!booking || booking.providerId !== request.body.providerId) {
                return response.status(404).json({ success: false, message: 'Booking not found' })
            }

            const customer = (await import('../config/appState.js')).demoUsers.find((item) => item.id === booking.customerId)

            if (!customer) {
                return response.status(404).json({ success: false, message: 'Customer not found' })
            }

            return response.json({
                success: true,
                data: { name: customer.name, email: customer.email, phone: customer.phone, city: customer.city },
            })
        }

        const provider = await Provider.findOne({ userId: request.user?.id })
        const booking = await Booking.findOne({ _id: request.params.bookingId, providerId: provider?._id })

        if (!booking) {
            return response.status(403).json({ success: false, message: 'You do not have access to this booking' })
        }

        const customer = await User.findById(booking.customerId)

        if (!customer) {
            return response.status(404).json({ success: false, message: 'Customer not found' })
        }

        response.json({ success: true, data: { name: customer.name, email: customer.email, phone: customer.phone, city: customer.city } })
    } catch (error) {
        next(error)
    }
})

router.post('/', auth('customer'), async (request, response, next) => {
    try {
        const { providerId, service, date, time, address, description, amount } = request.body

        if (!providerId || !service || !date || !time || !address) {
            return response.status(400).json({ success: false, message: 'Provider, service, date, time and address are required' })
        }

        if (!databaseReady) {
            const booking = {
                _id: `demo-booking-${Date.now()}`,
                providerId,
                customerId: request.user?.id,
                service,
                date,
                time,
                address,
                description,
                amount,
                bookingStatus: 'pending',
            }

            demoBookings.unshift(booking)
            return response.status(201).json({ success: true, message: 'Booking request created', data: booking })
        }

        const provider = await Provider.findById(providerId)

        if (!provider || !provider.isActive) {
            return response.status(404).json({ success: false, message: 'Service provider not found' })
        }

        const booking = await Booking.create({
            providerId: provider._id,
            service,
            date,
            time,
            address,
            description,
            amount,
            customerId: request.user?.id,
        })

        response.status(201).json({ success: true, message: 'Booking request created', data: booking })
    } catch (error) {
        next(error)
    }
})

router.get('/my', auth('customer'), async (request, response, next) => {
    try {
        const bookings = databaseReady
            ? await Booking.find({ customerId: request.user?.id }).sort({ createdAt: -1 })
            : demoBookings.filter((booking: DemoBooking) => booking.customerId === request.user?.id)

        response.json({ success: true, data: bookings })
    } catch (error) {
        next(error)
    }
})

router.get('/provider', auth('provider'), async (request, response, next) => {
    try {
        if (!databaseReady) {
            return response.json({ success: true, data: demoBookings })
        }

        const provider = await Provider.findOne({ userId: request.user?.id })

        if (!provider) {
            return response.json({ success: true, data: [] })
        }

        const bookings = await Booking.find({ providerId: provider._id }).sort({ createdAt: -1 })
        response.json({ success: true, data: bookings })
    } catch (error) {
        next(error)
    }
})

router.put('/:id/status', auth('provider'), async (request, response, next) => {
    try {
        const nextStatus = request.body.status
        const allowed: Record<string, string[]> = {
            pending: ['accepted', 'rejected'],
            accepted: ['on_the_way'],
            on_the_way: ['in_progress'],
            in_progress: ['completed'],
        }

        if (!allowed[request.body.currentStatus]?.includes(nextStatus)) {
            return response.status(400).json({ success: false, message: 'Invalid booking status transition' })
        }

        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id)

            if (!booking || booking.providerId !== request.body.providerId) {
                return response.status(404).json({ success: false, message: 'Booking not found' })
            }

            booking.bookingStatus = nextStatus
            return response.json({ success: true, message: 'Booking status updated', data: booking })
        }

        const provider = await Provider.findOne({ userId: request.user?.id })
        const booking = provider
            ? await Booking.findOneAndUpdate({ _id: request.params.id, providerId: provider._id, bookingStatus: request.body.currentStatus }, { bookingStatus: nextStatus }, { new: true })
            : null

        if (!booking) {
            return response.status(404).json({ success: false, message: 'Booking not found' })
        }

        response.json({ success: true, message: 'Booking status updated', data: booking })
    } catch (error) {
        next(error)
    }
})

router.post('/:id/review', auth('customer'), async (request, response, next) => {
    try {
        const { rating, comment } = request.body

        if (!rating || rating < 1 || rating > 5) {
            return response.status(400).json({ success: false, message: 'Rating must be between 1 and 5' })
        }

        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id && item.customerId === request.user?.id)

            if (!booking) {
                return response.status(404).json({ success: false, message: 'Booking not found' })
            }

            if (booking.bookingStatus !== 'completed') {
                return response.status(400).json({ success: false, message: 'Can only review completed bookings' })
            }

            booking.review = { rating, comment: comment || '' }

            const provider = demoProviders.find((p: DemoProvider) => p._id === booking.providerId) || demoProviderServices.find((p: DemoProvider) => p._id === booking.providerId)

            if (provider) {
                const allBookings = demoBookings.filter((b: DemoBooking) => b.providerId === booking.providerId && b.review)
                const avgRating = allBookings.reduce((sum: number, b: DemoBooking) => sum + (b.review?.rating || 0), 0) / allBookings.length
                provider.rating = Math.round(avgRating * 10) / 10
                provider.totalReviews = allBookings.length
            }

            return response.json({ success: true, message: 'Review submitted', data: booking })
        }

        const booking = await Booking.findOneAndUpdate(
            { _id: request.params.id, customerId: request.user?.id, bookingStatus: 'completed' },
            { review: { rating, comment: comment || '' } },
            { new: true },
        )

        if (!booking) {
            return response.status(404).json({ success: false, message: 'Booking not found or not completed' })
        }

        const allReviews = await Booking.find({ providerId: booking.providerId, 'review.rating': { $exists: true } })
        const avgRating = allReviews.reduce((sum: number, item: { review?: { rating?: number | null } | null }) => sum + (item.review?.rating ?? 0), 0) / allReviews.length

        await Provider.findByIdAndUpdate(booking.providerId, {
            rating: Math.round(avgRating * 10) / 10,
            totalReviews: allReviews.length,
        })

        response.json({ success: true, message: 'Review submitted', data: booking })
    } catch (error) {
        next(error)
    }
})

export default router
