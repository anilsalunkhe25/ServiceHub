import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import {
  createPaymentOrder,
  getMyPayments,
  getPaymentsForAdmin,
  getPayment,
  refundPayment,
  retryPayment,
  verifyPayment,
} from '../controllers/paymentController.js'

const router = Router()

router.post('/create-order', auth('customer'), createPaymentOrder)
router.post('/verify', auth('customer'), verifyPayment)
router.get('/my-payments', auth('customer'), getMyPayments)
router.get('/admin', auth('admin'), getPaymentsForAdmin)
router.get('/:paymentId', auth('customer'), getPayment)
router.post('/:paymentId/retry', auth('customer'), retryPayment)
router.post('/:paymentId/refund', auth('admin'), refundPayment)

export default router