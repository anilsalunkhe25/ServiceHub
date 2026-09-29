import { login as loginRequest, register as registerRequest, setAuthToken } from '../../../api'
import type { AuthRegisterPayload } from '../types/auth'

export async function loginUser(email: string, password: string) {
  const data = await loginRequest(email, password)
  setAuthToken(data.token)
  localStorage.setItem('servicehub_token', data.token)
  localStorage.setItem('servicehub_user', JSON.stringify(data.user))
  return data.user
}

export async function registerUser(payload: AuthRegisterPayload) {
  const data = await registerRequest(payload)
  setAuthToken(data.token)
  localStorage.setItem('servicehub_token', data.token)
  localStorage.setItem('servicehub_user', JSON.stringify(data.user))
  return data.user
}

export function logoutUser() {
  setAuthToken(null)
  localStorage.removeItem('servicehub_user')
  localStorage.removeItem('servicehub_token')
}
