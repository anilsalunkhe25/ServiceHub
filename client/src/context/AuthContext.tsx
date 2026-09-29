import { createContext, useContext, useEffect, useState } from 'react'
import { login as loginRequest, register as registerRequest, setAuthToken } from '../api'
import type { User } from '../api'

type AuthValue = {
  user: User | null;
  busy: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    role: string
  }) => Promise<void>;
  logout: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}

function getError(reason: unknown) {
  const message = (reason as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || 'Unable to connect. Please try again.'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('servicehub_user')
    const token = localStorage.getItem('servicehub_token')
    return stored && token ? (JSON.parse(stored) as User) : null
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setAuthToken(localStorage.getItem('servicehub_token'))
  }, [])

  const finish = (data: { user: User; token: string }) => {
    setUser(data.user)
    setAuthToken(data.token)
    localStorage.setItem('servicehub_token', data.token)
    localStorage.setItem('servicehub_user', JSON.stringify(data.user))
  }

  const login = async (email: string, password: string) => {
    setBusy(true)
    setError('')

    try {
      finish(await loginRequest(email, password))
    } catch (reason) {
      setError(getError(reason))
    } finally {
      setBusy(false)
    }
  }

  const register = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    role: string
  }) => {
    setBusy(true)
    setError('')

    try {
      finish(await registerRequest(data))
    } catch (reason) {
      setError(getError(reason))
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    setUser(null)
    setAuthToken(null)
    localStorage.removeItem('servicehub_user')
    localStorage.removeItem('servicehub_token')
  }

  return <AuthContext.Provider value={{ user, busy, error, login, register, logout }}>{children}</AuthContext.Provider>
}
