const sessionMaxAgeSeconds = 7 * 60 * 60

type TokenPayload = {
  iat?: number
  exp?: number
}

function readTokenPayload(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    return JSON.parse(decoded) as TokenPayload
  } catch {
    return null
  }
}

export function getSessionRemainingMs(token: string, nowMs = Date.now()) {
  const payload = readTokenPayload(token)
  if (typeof payload?.iat !== 'number' || typeof payload.exp !== 'number') return 0

  const nowSeconds = nowMs / 1000
  const sessionExpiresAt = Math.min(payload.exp, payload.iat + sessionMaxAgeSeconds)
  if (payload.iat > nowSeconds + 60 || sessionExpiresAt <= nowSeconds) return 0
  return (sessionExpiresAt - nowSeconds) * 1000
}

export function isSessionTokenActive(token: string, nowMs = Date.now()) {
  return getSessionRemainingMs(token, nowMs) > 0
}
