import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import routes from './routes/index.js'
import { processRazorpayWebhook } from './controllers/webhookController.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setDatabaseReady } from './config/appState.js'

const app = express()
const port = Number(process.env.PORT ?? 5000)
const allowedClientOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']
  .filter((origin): origin is string => Boolean(origin))

app.use(helmet())
app.use(cors({ origin: allowedClientOrigins }))
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a moment and try again.' },
}))
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), processRazorpayWebhook)
app.use(express.json({ limit: '5mb' }))

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      setDatabaseReady(true)
      console.log('MongoDB connected')
    })
    .catch((error: Error) => {
      console.warn('MongoDB not connected. Running in demo mode.', error.message)
      setDatabaseReady(false)
    })
} else {
  setDatabaseReady(false)
  console.log('MongoDB URI not provided. Running in demo mode.')
}

app.use('/api', routes)
app.use(errorHandler)

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
