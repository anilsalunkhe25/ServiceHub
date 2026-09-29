import { Router } from 'express'

const router = Router()

router.get('/health', (_request, response) => {
  response.json({ success: true, message: 'Service Hub API is running' })
})

export default router
