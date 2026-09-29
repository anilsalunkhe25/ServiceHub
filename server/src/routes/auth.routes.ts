import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { User, demoUsers, databaseReady, tokenFor } from '../config/appState.js'
import type { AuthUser } from '../config/appState.js'

const router = Router()

router.post('/register', async (request, response, next) => {
  try {
    const { name, email, phone, password, city, role = 'customer' } = request.body

    if (!name || !email || !password) {
      return response.status(400).json({ success: false, message: 'Name, email and password are required' })
    }

    const normalizedEmail = String(email).toLowerCase().trim()
    const passwordHash = await bcrypt.hash(password, 12)

    if (!databaseReady) {
      if (demoUsers.some((item: AuthUser) => item.email === normalizedEmail)) {
        return response.status(409).json({ success: false, message: 'Email is already registered' })
      }

      const user: AuthUser = {
        id: `demo-${Date.now()}`,
        name,
        email: normalizedEmail,
        phone,
        city,
        role,
        password: passwordHash,
      }

      demoUsers.push(user)
      return response.status(201).json({
        success: true,
        message: 'Account created in demo mode',
        data: {
          user: { id: user.id, name, email: user.email, role, city },
          token: tokenFor(user),
        },
      })
    }

    const exists = await User.findOne(
        { email: normalizedEmail }
    )

    if (exists) {
      return response.status(409).json({ success: false, message: 'Email is already registered' })
    }

    const user = await User.create(
        { name, email: normalizedEmail, phone, city, role, password: passwordHash }
    )

    response.status(201).json({
      success: true,
      message: 'Account created',
      data: { user: { id: user.id, name, email, role, city }, token: tokenFor({ id: user.id, role }) },
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (request, response, next) => {
  try {
    const { email, password } = request.body
    const normalizedEmail = String(email).toLowerCase().trim()

    if (!databaseReady) {
      const user = demoUsers.find((item: AuthUser) => item.email === normalizedEmail)
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return response.status(401).json({ success: false, message: 'Invalid email or password' })
      }

      return response.json({
        success: true,
        message: 'Welcome back',
        data: {
          user: { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city },
          token: tokenFor(user),
        },
      })
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password')

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return response.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    response.json({
      success: true,
      message: 'Welcome back',
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, city: user.city },
        token: tokenFor({ id: user.id, role: user.role }),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
