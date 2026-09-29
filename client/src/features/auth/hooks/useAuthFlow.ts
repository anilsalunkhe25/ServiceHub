import { useContext } from 'react'
import { AuthContext } from '../../../context/AuthContext'

export function useAuthFlow() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
