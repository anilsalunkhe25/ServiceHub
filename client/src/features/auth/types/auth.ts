export type AuthRegisterPayload = {
  name: string
  email: string
  phone: string
  password: string
  city: string
  role: string
}

export type AuthContextValue = {
  user: import('../../../api').User | null
  busy: boolean
  error: string
  login: (email: string, password: string) => Promise<void>
  register: (data: AuthRegisterPayload) => Promise<void>
  logout: () => void
}
