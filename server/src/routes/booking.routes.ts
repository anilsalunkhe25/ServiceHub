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
        const { providerId, service, date, time, address, description, amount, paymentMethod, urgent } = request.body

        if (!providerId || !service || !date || !time || !address) {
            return response.status(400).json({ success: false, message: 'Provider, service, date, time and address are required' })
        }

        if (paymentMethod !== undefined && !['cash_on_delivery', 'upi'].includes(paymentMethod)) {
            return response.status(400).json({ success: false, message: 'Choose Cash on delivery or UPI' })
        }

        const selectedPaymentMethod = paymentMethod || 'cash_on_delivery'

        if (!databaseReady) {
            const provider = [...demoProviders, ...demoProviderServices].find((item: DemoProvider) => item._id === providerId)
            if (!provider) return response.status(404).json({ success: false, message: 'Service provider not found' })

            const booking = {
                _id: `demo-booking-${Date.now()}`,
                providerId,
                providerBusinessName: provider.businessName,
                customerId: request.user?.id,
                service,
                date,
                time,
                address,
                description,
                amount,
                paymentMethod: selectedPaymentMethod,
                urgent: Boolean(urgent),
                bookingStatus: 'pending',
            }

            demoBookings.unshift(booking)
            return response.status(201).json({ success: true, message: 'Booking request created', data: booking })
        }

        if (!/^[a-f\d]{24}$/i.test(String(providerId))) {
            return response.status(404).json({ success: false, message: 'Service provider not found' })
        }

        const provider = await Provider.findById(providerId)

        if (!provider || !provider.isActive) {
            return response.status(404).json({ success: false, message: 'Service provider not found' })
        }
        if (provider.isAvailable === false) {
            return response.status(409).json({ success: false, message: 'This provider is not currently accepting bookings' })
        }

        const booking = await Booking.create({
            providerId: provider._id,
            providerBusinessName: provider.businessName,
            service,
            date,
            time,
            address,
            description,
            amount,
            paymentMethod: selectedPaymentMethod,
            urgent: Boolean(urgent),
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

router.put('/:id/customer-action', auth('customer'), async (request, response, next) => {
    try {
        const { action, date, time } = request.body
        const allowedStatuses = ['pending', 'accepted']

        if (!['cancel', 'reschedule'].includes(action)) {
            return response.status(400).json({ success: false, message: 'Invalid booking action' })
        }

        if (action === 'reschedule' && (!date || !time)) {
            return response.status(400).json({ success: false, message: 'A new date and time are required' })
        }

        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id && item.customerId === request.user?.id)
            if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
            if (!allowedStatuses.includes(booking.bookingStatus)) {
                return response.status(400).json({ success: false, message: 'This booking can no longer be changed' })
            }

            if (action === 'cancel') booking.bookingStatus = 'cancelled'
            else Object.assign(booking, { date, time })
            return response.json({ success: true, message: 'Booking updated', data: booking })
        }

        const filter: Record<string, unknown> = { _id: String(request.params.id), customerId: request.user?.id, bookingStatus: { $in: allowedStatuses } }
        const update: Record<string, unknown> = action === 'cancel' ? { bookingStatus: 'cancelled' } : { date, time }
        const booking = await Booking.findOneAndUpdate(filter, update, { new: true })
        if (!booking) return response.status(404).json({ success: false, message: 'Booking not found or no longer changeable' })
        response.json({ success: true, message: 'Booking updated', data: booking })
    } catch (error) {
        next(error)
    }
})

router.post('/:id/payment', auth('customer'), async (request, response, next) => {
    try {
        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id && item.customerId === request.user?.id)
            if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
            if (booking.paymentMethod !== 'upi') {
                return response.status(400).json({ success: false, message: 'This booking is set to Cash on delivery' })
            }
            if (['cancelled', 'rejected'].includes(booking.bookingStatus)) {
                return response.status(400).json({ success: false, message: 'This booking cannot be paid' })
            }
            Object.assign(booking, { paymentStatus: 'paid' })
            return response.json({ success: true, message: 'Demo payment recorded', data: booking })
        }

        const booking = await Booking.findOneAndUpdate(
            { _id: request.params.id, customerId: request.user?.id, paymentMethod: 'upi', bookingStatus: { $nin: ['cancelled', 'rejected'] } },
            { paymentStatus: 'paid' },
            { new: true },
        )
        if (!booking) return response.status(404).json({ success: false, message: 'Booking not found or cannot be paid' })
        response.json({ success: true, message: 'Demo payment recorded', data: booking })
    } catch (error) {
        next(error)
    }
})

router.get('/:id/messages', auth(), async (request, response, next) => {
    try {
        const booking = databaseReady
            ? await Booking.findById(request.params.id)
            : demoBookings.find((item: DemoBooking) => item._id === request.params.id)
        if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })

        const provider = request.user?.role === 'provider'
            ? databaseReady
                ? await Provider.findOne({ userId: request.user.id })
                : demoProviderServices.find((item) => item.userId === request.user?.id)
            : null
        const ownsBooking = request.user?.role === 'customer'
            ? String(booking.customerId) === request.user.id
            : String(booking.providerId) === String(provider?._id)
        if (!ownsBooking) return response.status(403).json({ success: false, message: 'You do not have access to this booking' })

        response.json({ success: true, data: booking.messages || [] })
    } catch (error) {
        next(error)
    }
})

router.post('/:id/messages', auth(), async (request, response, next) => {
    try {
        const message = String(request.body.message || '').trim()
        if (!message) return response.status(400).json({ success: false, message: 'Message cannot be empty' })
        if (message.length > 1000) return response.status(400).json({ success: false, message: 'Message must be 1000 characters or fewer' })
        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id)
            if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
            const ownsBooking = request.user?.role === 'customer'
                ? booking.customerId === request.user.id
                : demoProviderServices.some((provider) => provider.userId === request.user?.id && provider._id === booking.providerId)
            if (!ownsBooking) return response.status(403).json({ success: false, message: 'You do not have access to this booking' })
            const entry = { senderId: request.user?.id || '', senderRole: request.user?.role || '', message, createdAt: new Date().toISOString() }
            booking.messages = [...(booking.messages || []), entry]
            return response.json({ success: true, message: 'Message sent', data: booking })
        }
        const booking = await Booking.findById(request.params.id)
        if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
        const provider = request.user?.role === 'provider' ? await Provider.findOne({ userId: request.user.id }) : null
        const ownsBooking = request.user?.role === 'customer'
            ? String(booking.customerId) === request.user.id
            : String(booking.providerId) === String(provider?._id)
        if (!ownsBooking) return response.status(403).json({ success: false, message: 'You do not have access to this booking' })
        booking.messages.push({ senderId: request.user?.id, senderRole: request.user?.role, message, createdAt: new Date().toISOString() })
        await booking.save()
        response.json({ success: true, message: 'Message sent', data: booking })
    } catch (error) {
        next(error)
    }
})

router.post('/:id/complaint', auth('customer'), async (request, response, next) => {
    try {
        const message = String(request.body.message || '').trim()
        if (message.length < 10 || message.length > 2000) {
            return response.status(400).json({ success: false, message: 'Complaint must be between 10 and 2000 characters' })
        }

        if (!databaseReady) {
            const booking = demoBookings.find((item: DemoBooking) => item._id === request.params.id && item.customerId === request.user?.id)
            if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
            const provider = [...demoProviders, ...demoProviderServices].find((item: DemoProvider) => item._id === booking.providerId)
            Object.assign(booking, { complaint: { message, providerBusinessName: booking.providerBusinessName || provider?.businessName, status: 'open', createdAt: new Date().toISOString() } })
            return response.json({ success: true, message: 'Complaint submitted', data: booking })
        }

        const booking = await Booking.findOne({ _id: request.params.id, customerId: request.user?.id })
        if (!booking) return response.status(404).json({ success: false, message: 'Booking not found' })
        const provider = await Provider.findById(booking.providerId)
        booking.complaint = {
            message,
            providerBusinessName: booking.providerBusinessName || provider?.businessName,
            status: 'open',
            createdAt: new Date().toISOString(),
        }
        await booking.save()
        response.json({ success: true, message: 'Complaint submitted', data: booking })
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
