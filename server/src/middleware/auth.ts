import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../config/appState.js'

export function auth(requiredRole?: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const token = request.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return response.status(401).json({ success: false, message: 'Authentication required' })
    }

    try {
      const payload = jwt.verify(token, jwtSecret, { maxAge: '7h' }) as { id: string; role: string }

      if (requiredRole && payload.role !== requiredRole) {
        return response.status(403).json({ success: false, message: `This action requires a ${requiredRole} account` })
      }

      request.user = payload
      next()
    } catch {
      response.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}

export function optionalAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization

  if (!authorization) {
    next()
    return
  }

  const token = authorization.replace(/^Bearer\s+/i, '')

  try {
    const payload = jwt.verify(token, jwtSecret, { maxAge: '7h' }) as { id: string; role: string }
    request.user = payload
    next()
  } catch {
    request.user = undefined
    next()
  }
}
