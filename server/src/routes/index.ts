import { Router } from 'express'
import authRoutes from './auth.routes.js'
import providerRoutes from './provider.routes.js'
import bookingRoutes from './booking.routes.js'
import healthRoutes from './health.routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/providers', providerRoutes)
router.use('/bookings', bookingRoutes)
router.use('/', healthRoutes)

export default router
