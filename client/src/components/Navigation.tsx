import { useState } from 'react'
import { ArrowRight, LogOut, Menu, UserRound, X, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Navigation() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()

  return (
    <header className="nav-wrap">
      <nav className="nav container">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </span>
          service<span>hub</span>
        </Link>

        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          {open ? <X /> : <Menu />}
        </button>

        <div className={`nav-links ${open ? 'is-open' : ''}`}>
          <Link to="/services">Explore services</Link>
          <a href="/#how">How it works</a>
          <a href="/#cities">Cities</a>
          <a href="/#about">About us</a>

          {user ? (
            <>
              <Link to="/dashboard" className="user-link">
                <UserRound size={15} /> {user.name.split(' ')[0]}
              </Link>
              <button className="logout-button" onClick={logout}>
                <LogOut size={15} /> Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="login-link">Log in</Link>
          )}

          {!user && (
            <Link to="/register" className="provider-cta">
              Create account <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
