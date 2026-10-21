import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { postChatMessage } from '../controllers/chatbotController.js'
import { optionalAuth } from '../middleware/auth.js'

const router = Router()

const chatbotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'The assistant is receiving too many requests. Please try again later.' },
})

router.post('/message', chatbotLimiter, optionalAuth, postChatMessage)

export default router
