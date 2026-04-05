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
    const { data } = await supabase.from('users').select('role').eq('id', userId).single()
    setUserRole(data?.role || 'reader')
  }

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, genre, author_id, author_name, file_path, cover_path, status, created_at')
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
        if (
          error.message?.toLowerCase().includes('already') ||
          error.message?.toLowerCase().includes('exists') ||
          error.status === 422 ||
          error.code === '225'
        ) {
          alert('This email is already registered. Please try logging in instead.')
        } else {
          alert('Signup failed: ' + error.message)
        }
        return
      }
      if (data.user) {
        await supabase.from('users').insert({
          id:          data.user.id,
          email:       data.user.email,
          role:        selectedRole,
          author_name: selectedRole === 'author' ? authorName.trim() : null,
          balance:     0
        })
        alert('Account created successfully! Please check your email for confirmation.')
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

  // ── Set new password screen (after clicking reset link in email) ────────
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-blue-800">SafeRead KE</h1>
          <h2 className="text-lg font-semibold text-center mb-6 text-gray-600">Set a new password</h2>
          <p className="text-gray-500 text-sm mb-5 text-center">
            Choose a strong password for your account.
          </p>
          <input
            type="password"
            placeholder="New password (6+ characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSetNewPassword}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition disabled:opacity-70"
          >
            {loading ? 'Updating…' : 'Set New Password'}
          </button>
        </div>
      </div>
    )
  }

  // ── Login / Signup screen ────────────────────────────────────────────────
  if (!user) {

    // ── Forgot password screen ─────────────────────────────────────────
    if (showForgotPassword) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md">
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-blue-800">SafeRead KE</h1>
            <h2 className="text-lg font-semibold text-center mb-6 text-gray-600">Reset your password</h2>

            {resetSent ? (
              <div className="text-center">
                <div className="text-5xl mb-4">📧</div>
                <p className="text-gray-700 font-medium mb-2">Check your email!</p>
                <p className="text-gray-500 text-sm mb-6">
                  We sent a password reset link to <strong>{resetEmail}</strong>.
                  Click the link in the email to set a new password.
                </p>
                <button
                  onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail('') }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-5 text-center">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full p-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium mb-3 transition disabled:opacity-70"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
                <button
                  onClick={() => { setShowForgotPassword(false); setResetEmail('') }}
                  className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm transition"
                >
                  ← Back to Login
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-8 text-blue-800">SafeRead KE</h1>

          {/* Step 1: Role selector */}
          <div className="mb-5 text-center">
            <p className="mb-3 font-semibold text-gray-700">I am joining as a:</p>
            <div className="flex justify-center gap-4">
              <label className={`flex-1 border-2 rounded-xl py-3 px-4 cursor-pointer transition text-center font-medium ${
                signupRole === 'reader' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="reader"
                  checked={signupRole === 'reader'}
                  onChange={(e) => setSignupRole(e.target.value)}
                  className="hidden"
                />
                📖 Reader
              </label>
              <label className={`flex-1 border-2 rounded-xl py-3 px-4 cursor-pointer transition text-center font-medium ${
                signupRole === 'author' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="author"
                  checked={signupRole === 'author'}
                  onChange={(e) => setSignupRole(e.target.value)}
                  className="hidden"
                />
                ✍️ Author
              </label>
            </div>
          </div>

          {/* Step 2: Author name — only shown when author is selected */}
          {signupRole === 'author' && (
            <input
              type="text"
              placeholder="Your full name or pen name *"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full p-3 mb-4 border-2 border-blue-300 rounded-xl focus:outline-none focus:border-blue-500 bg-blue-50"
            />
          )}

          {/* Step 3: Email & password */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium mb-3 transition disabled:opacity-70"
          >
            {loading ? 'Creating Account…' : 'Create Account'}
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition disabled:opacity-70"
          >
            {loading ? 'Logging in…' : 'Login'}
          </button>

          <button
            onClick={() => { setShowForgotPassword(true); setResetEmail(email) }}
            className="w-full text-center text-sm text-blue-500 hover:text-blue-700 mt-3 transition"
          >
            Forgot your password?
          </button>
        </div>
      </div>
    )
  }

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-blue-800 text-white p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">SafeRead KE</h1>
          <div className="flex items-center gap-3 sm:gap-4">
            <p className="text-sm sm:text-base hidden sm:block">
              Welcome, {user.email} ({userRole})
            </p>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 text-sm sm:text-base rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {userRole === 'admin' && (
          <AdminDashboard adminDashboardBg={adminDashboardBg} />
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
          />
        )}
        {userRole === 'reader' && (
          <ReaderDashboard
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
          />
        )}
      </main>

      {/* ── Book reader modal ── */}
      {selectedBookForReading && (
        <div className="fixed inset-0 bg-white z-[100] overflow-auto">
          <div className="p-4 bg-gray-100 border-b sticky top-0">
            <button
              onClick={closeReader}
              className="bg-gray-700 text-white px-5 py-2 rounded-lg hover:bg-gray-800"
            >
              ← Back to List
            </button>
          </div>
          <div className="p-4">
            {/* Pass the full book object so SecureReader can log page views */}
            <SecureReader book={selectedBookForReading} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App