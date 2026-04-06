// src/App.jsx
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import BookUpload from './components/BookUpload'
import AdminDashboard from './components/AdminDashboard'
import SecureReader from './components/SecureReader'
import AuthorDashboard from './components/AuthorDashboard'
import ReaderDashboard from './components/ReaderDashboard'

import readerDashboardBg from './assets/readerdashboard.jpg'
import authorDashboardBg from './assets/authordashboard.jpg'
import adminDashboardBg from './assets/AdminDashboard1.png'

const genres = [
  'Sci-Fi', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Thriller', 'Historical',
  'Biography', 'Self-Help', 'Poetry', 'Young Adult', 'Business', 'Science',
  'Travel', 'Cooking', 'Art', 'Religion', 'Health', 'Other'
]

function App() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupRole, setSignupRole] = useState('reader')
  const [authorName, setAuthorName] = useState('')
  const [username, setUsername]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showResetPassword, setShowResetPassword]   = useState(false)
  const [newPassword, setNewPassword]               = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [books, setBooks] = useState([])
  const [selectedGenre, setSelectedGenre] = useState('Home')
  const [readerTab, setReaderTab] = useState('home')
  const [authorTab, setAuthorTab] = useState('home')
  const [selectedBookForReading, setSelectedBookForReading] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRole(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link — show new password form instead of logging in
        setShowResetPassword(true)
        setUser(session?.user ?? null)
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRole(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('role, username, author_name')
      .eq('id', userId)
      .single()
    setUserRole(data?.role || 'reader')
    setDisplayName(data?.username || data?.author_name || '')
  }

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, genre, author_id, author_name, file_path, cover_path, status, created_at, is_paid, price')
      .eq('status', 'approved')
    if (error) {
      console.error('Fetch books error:', error)
      return
    }
    setBooks(data || [])
  }

  useEffect(() => {
    if (user) fetchBooks()
  }, [user])

  const handleSignup = async () => {
    if (!email || !password) {
      alert('Please enter email and password')
      return
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }
    if (!username.trim()) {
      alert('Please enter a username.')
      return
    }
    if (signupRole === 'author' && !authorName.trim()) {
      alert('Please enter your author name.')
      return
    }
    setLoading(true)
    try {
      const selectedRole = signupRole === 'author' ? 'author' : 'reader'
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { role: selectedRole } }
      })
      if (error) {
        alert('Signup failed: ' + error.message)
        return
      }

      // Supabase returns a session-less user with identities=[] for existing emails
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        alert('This email is already registered. Please log in instead.')
        return
      }

      if (data.user) {
        await supabase.from('users').insert({
          id:          data.user.id,
          email:       data.user.email,
          role:        selectedRole,
          username:    username.trim(),
          author_name: selectedRole === 'author' ? authorName.trim() : null,
          balance:     0
        })
        alert('Account created! Please check your email to confirm your account.')
      }
    } catch (err) {
      console.error('Unexpected signup error:', err)
      alert('Unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please enter email and password')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })
    if (error) alert('Login failed: ' + error.message)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      alert('Please enter your email address.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase(),
      { redirectTo: window.location.origin }
    )
    setLoading(false)
    if (error) {
      alert('Failed to send reset email: ' + error.message)
    } else {
      setResetSent(true)
    }
  }
  const handleSetNewPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) {
      alert('Failed to update password: ' + error.message)
    } else {
      alert('Password updated successfully! You are now logged in.')
      setShowResetPassword(false)
      setNewPassword('')
      // Fetch role so the correct dashboard loads
      if (user) fetchUserRole(user.id)
    }
  }

  const openReader  = (book) => setSelectedBookForReading(book)
  const closeReader = ()     => setSelectedBookForReading(null)

  const filteredBooks = selectedGenre === 'Home'
    ? []
    : books.filter(book => book.genre === selectedGenre)

  // ── Set new password screen ──────────────────────────────────────────────
  if (showResetPassword) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px',
          padding: '2.5rem', width: '100%', maxWidth: '420px', color: 'white'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}>SafeRead KE</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Set a new password</p>
          </div>
          <input
            type="password"
            placeholder="New password (6+ characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.95rem',
              outline: 'none', boxSizing: 'border-box', marginBottom: '1rem'
            }}
          />
          <button
            onClick={handleSetNewPassword}
            disabled={loading}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white',
              fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Updating…' : 'Set New Password'}
          </button>
        </div>
      </div>
    )
  }

  // ── Login / Signup screen ────────────────────────────────────────────────
  if (!user) {
    const pageStyle = {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }
    const cardStyle = {
      background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '24px',
      padding: '2.5rem', width: '100%', maxWidth: '420px', color: 'white'
    }
    const inputStyle = {
      width: '100%', padding: '0.875rem 1rem', borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
      color: 'white', fontSize: '0.95rem', outline: 'none',
      boxSizing: 'border-box', marginBottom: '0.85rem'
    }

    // ── Forgot password ──────────────────────────────────────────────────
    if (showForgotPassword) {
      return (
        <div style={pageStyle}>
          <div style={cardStyle}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📬</div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>SafeRead KE</h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontSize: '0.9rem' }}>Reset your password</p>
            </div>

            {resetSent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Check your email!</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  We sent a reset link to <strong>{resetEmail}</strong>
                </p>
                <button
                  onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail('') }}
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  Enter your account email and we'll send you a reset link.
                </p>
                <input
                  type="email" placeholder="Your email address"
                  value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  style={inputStyle}
                />
                <button
                  onClick={handleForgotPassword} disabled={loading}
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: '0.75rem' }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  onClick={() => { setShowForgotPassword(false); setResetEmail('') }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  ← Back to Login
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    // ── Main login / signup ──────────────────────────────────────────────
    return (
      <div style={pageStyle}>
        {/* Left panel — branding (hidden on small screens via CSS) */}
        <style>{`
          @media (max-width: 700px) { .auth-branding { display: none !important; } }
          @media (min-width: 701px) { .auth-branding { display: flex !important; } }
        `}</style>
        <div className="auth-branding" style={{
          display: 'none', flexDirection: 'column', justifyContent: 'center',
          maxWidth: '380px', marginRight: '3rem', color: 'white',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.2, marginBottom: '1rem' }}>
            Kenya's Secure Reading Platform
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', lineHeight: 1.7 }}>
            Read, publish, and support Kenyan authors — with full protection against digital piracy.
          </p>
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {['Canvas-rendered pages — impossible to download', 'Donate to authors via M-Pesa', 'Earn from ads as an author'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}>
              SafeRead KE
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', fontSize: '0.85rem' }}>
              Read freely. Publish safely.
            </p>
          </div>

          {/* Role selector */}
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
            I am joining as
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[{ val: 'reader', icon: '📖', label: 'Reader' }, { val: 'author', icon: '✍️', label: 'Author' }].map(({ val, icon, label }) => (
              <label key={val} style={{
                flex: 1, padding: '0.75rem', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                border: signupRole === val ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.2)',
                background: signupRole === val ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
                color: signupRole === val ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                fontWeight: signupRole === val ? 600 : 400, fontSize: '0.9rem', transition: 'all 0.2s'
              }}>
                <input type="radio" name="role" value={val} checked={signupRole === val} onChange={(e) => setSignupRole(e.target.value)} style={{ display: 'none' }} />
                {icon} {label}
              </label>
            ))}
          </div>

          {/* Username — for all users */}
          <input
            type="text" placeholder="Choose a username *"
            value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ ...inputStyle, borderColor: 'rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.1)' }}
          />

          {/* Author name — only for authors */}
          {signupRole === 'author' && (
            <input
              type="text" placeholder="Your full name or pen name *"
              value={authorName} onChange={(e) => setAuthorName(e.target.value)}
              style={{ ...inputStyle, borderColor: 'rgba(167,139,250,0.5)', background: 'rgba(167,139,250,0.1)' }}
            />
          )}

          {/* Email */}
          <input
            type="email" placeholder="Email address"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          {/* Password */}
          <input
            type="password" placeholder="Password (6+ characters)"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: '1.25rem' }}
          />

          {/* Create account */}
          <button
            onClick={handleSignup} disabled={loading}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white', fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginBottom: '0.75rem', letterSpacing: '0.025em'
            }}
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* Login */}
          <button
            onClick={handleLogin} disabled={loading}
            style={{
              width: '100%', padding: '0.875rem', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
              color: 'white', fontSize: '1rem', fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              marginBottom: '1rem', letterSpacing: '0.025em'
            }}
          >
            {loading ? 'Logging in…' : 'Login to Existing Account'}
          </button>

          {/* Forgot password */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => { setShowForgotPassword(true); setResetEmail(email) }}
              style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.8)', fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Forgot your password?
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0b0d' }}>
      <header style={{
        background: 'rgba(10,11,13,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0.625rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.1rem' }}>📚</span>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Georgia, serif', color: 'white', letterSpacing: '0.025em' }}>
            SafeRead KE
          </h1>
        </div>

        {/* Search bar */}
        <div style={{ flex: 1, position: 'relative', maxWidth: '480px' }}>
          <span style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder={userRole === 'admin' ? 'Search books, users…' : 'Search books…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.45rem 2rem 0.45rem 2rem',
              borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.07)', color: 'white',
              fontSize: '0.85rem', outline: 'none', fontFamily: 'sans-serif'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* User + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: 'auto' }}>
          <div style={{ textAlign: 'right', maxWidth: '120px', overflow: 'hidden' }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {displayName || user.email}
            </p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', margin: 0 }}>
              {userRole}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.45rem 0.875rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem',
              cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1">
        {userRole === 'admin' && (
          <AdminDashboard adminDashboardBg={adminDashboardBg} searchQuery={searchQuery} />
        )}
        {userRole === 'author' && (
          <AuthorDashboard
            user={user}
            authorTab={authorTab}
            setAuthorTab={setAuthorTab}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
            genres={genres}
            filteredBooks={filteredBooks}
            openReader={openReader}
            authorDashboardBg={authorDashboardBg}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            searchQuery={searchQuery}
          />
        )}
        {userRole === 'reader' && (
          <ReaderDashboard
            user={user}
            readerTab={readerTab}
            setReaderTab={setReaderTab}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
            genres={genres}
            filteredBooks={filteredBooks}
            openReader={openReader}
            readerDashboardBg={readerDashboardBg}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            searchQuery={searchQuery}
          />
        )}
      </main>

      {/* ── Book reader modal ── */}
      {selectedBookForReading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#e5e7eb', display: 'flex', flexDirection: 'column' }}>
          {/* Back button bar */}
          <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.625rem 1rem', flexShrink: 0 }}>
            <button
              onClick={closeReader}
              style={{ background: '#374151', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
            >
              ← Back to List
            </button>
          </div>
          {/* SecureReader fills remaining space */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <SecureReader book={selectedBookForReading} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App