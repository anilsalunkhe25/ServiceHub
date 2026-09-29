import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import routes from './routes/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import { setDatabaseReady } from './config/appState.js'

const app = express()
const port = Number(process.env.PORT ?? 5000)
const allowedClientOrigins = [process.env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']
  .filter((origin): origin is string => Boolean(origin))

app.use(helmet())
app.use(cors({ origin: allowedClientOrigins }))
app.use(express.json({ limit: '5mb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 }))

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

