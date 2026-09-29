import type { NextFunction, Request, Response } from 'express'

export function errorHandler(error: Error, _request: Request, response: Response, _next: NextFunction) {
  console.error(error.message)
  response.status(500).json({ success: false, message: 'Something went wrong' })
}
