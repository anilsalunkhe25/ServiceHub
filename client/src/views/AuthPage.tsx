import { useEffect, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { useAuth } from '../context/AuthContext'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register, busy, error } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    if (mode === 'login') {
      await login(String(form.get('email')), String(form.get('password')))
      return
    }

    await register({
      name: String(form.get('name')),
      email: String(form.get('email')),
      phone: String(form.get('phone')),
      password: String(form.get('password')),
      city: String(form.get('city')),
      role: String(form.get('role')),
    })
  }

  return (
    <>
      <Navigation />
      <main className="auth-page">
        <div className="auth-panel">
          <p className="kicker">Service Hub account</p>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Find your people.'}</h1>
          <p className="auth-subtitle">{mode === 'login' ? 'Sign in to manage your bookings and saved providers.' : 'Create an account and get trusted help in your city.'}</p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label>
                  Your name
                  <input name="name" required placeholder="Aarav Sharma" />
                </label>
                <label>
                  Phone number
                  <input name="phone" required placeholder="+91 98765 43210" />
                </label>
                <label>
                  I am joining as
                  <select name="role">
                    <option value="customer">Customer</option>
                    <option value="provider">Service provider</option>
                  </select>
                </label>
                <label>
                  City
                  <input name="city" required placeholder="Pune" />
                </label>
              </>
            )}

            <label>
              Email address
              <input name="email" type="email" required placeholder="you@example.com" />
            </label>

            <label>
              Password
              <input name="password" type="password" minLength={8} required placeholder="At least 8 characters" />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button className="auth-submit" disabled={busy}>
              {busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create my account'}
              <ArrowRight size={17} />
            </button>
          </form>

          <p className="switch-auth">
            {mode === 'login' ? 'New to Service Hub?' : 'Already have an account?'}
            <Link to={mode === 'login' ? '/register' : '/login'}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </Link>
          </p>
        </div>
      </main>
    </>
  )
}
