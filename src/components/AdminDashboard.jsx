// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import SecureReader from './SecureReader'

export default function AdminDashboard({ adminDashboardBg }) {
  const [pendingBooks, setPendingBooks]   = useState([])
  const [approvedBooks, setApprovedBooks] = useState([])
  const [users, setUsers]                 = useState([])
  const [bookViews, setBookViews]         = useState([])   // [{title, count}]
  const [donations, setDonations]         = useState([])   // platform-wide
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [approvingId, setApprovingId]     = useState(null)
  const [rejectingId, setRejectingId]     = useState(null)
  const [updatingRole, setUpdatingRole]   = useState(null)
  const [adminTab, setAdminTab]           = useState('home')
  const [selectedGenre, setSelectedGenre] = useState('Sci-Fi')
  const [selectedBookForReading, setSelectedBookForReading] = useState(null)

  const genres = [
    'Sci-Fi', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Thriller', 'Historical',
    'Biography', 'Self-Help', 'Poetry', 'Young Adult', 'Business', 'Science',
    'Travel', 'Cooking', 'Art', 'Religion', 'Health', 'Other'
  ]

  // ── Fetchers ────────────────────────────────────────────────────────────
  const fetchPendingBooks = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('books')
        .select('id, title, genre, author_id, author_name, file_path, cover_path, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPendingBooks(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchApprovedBooks = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('books')
        .select('id, title, genre, author_id, author_name, file_path, cover_path, status, created_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (error) throw error
      setApprovedBooks(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchUsers = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, author_name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      setUsers(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchBookViews = async () => {
    setLoading(true); setError(null)
    try {
      // Get all books
      const { data: books, error: bErr } = await supabase
        .from('books')
        .select('id, title, author_name')
        .eq('status', 'approved')
      if (bErr) throw bErr

      // Get page_views counts per book
      const { data: views, error: vErr } = await supabase
        .from('page_views')
        .select('book_id')
      if (vErr) throw vErr

      // Count views per book
      const counts = {}
      views?.forEach(v => { counts[v.book_id] = (counts[v.book_id] || 0) + 1 })

      const merged = (books || [])
        .map(b => ({ ...b, views: counts[b.id] || 0 }))
        .sort((a, b) => b.views - a.views)

      setBookViews(merged)

      // Also fetch platform-wide donations
      const { data: dons } = await supabase
        .from('donations')
        .select('id, amount, created_at, author_id, status')
        .order('created_at', { ascending: false })
        .limit(20)
      setDonations(dons || [])

    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (adminTab === 'pending') fetchPendingBooks()
    else if (adminTab === 'genres') fetchApprovedBooks()
    else if (adminTab === 'users') fetchUsers()
    else if (adminTab === 'views') fetchBookViews()
  }, [adminTab])

  // ── Actions ─────────────────────────────────────────────────────────────
  const approveBook = async (bookId) => {
    setApprovingId(bookId)
    try {
      const { error } = await supabase.from('books').update({ status: 'approved' }).eq('id', bookId)
      if (error) throw error
      fetchPendingBooks()
    } catch (err) { alert('Approval failed: ' + err.message) }
    finally { setApprovingId(null) }
  }

  const rejectBook = async (bookId) => {
    if (!window.confirm('Reject and delete this book?')) return
    setRejectingId(bookId)
    try {
      const { error } = await supabase.from('books').delete().eq('id', bookId)
      if (error) throw error
      fetchPendingBooks()
    } catch (err) { alert('Rejection failed: ' + err.message) }
    finally { setRejectingId(null) }
  }

  const updateUserRole = async (userId, newRole) => {
    setUpdatingRole(userId)
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    } catch (err) { alert('Role update failed: ' + err.message) }
    finally { setUpdatingRole(null) }
  }

  const openReader  = (book) => setSelectedBookForReading(book)
  const closeReader = ()     => setSelectedBookForReading(null)

  const filteredApprovedBooks = approvedBooks.filter(b => b.genre === selectedGenre)
  const authorLabel = (book) => book.author_name || (book.author_id ? book.author_id.substring(0, 8) + '…' : 'Unknown')
  const fmt = n => `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  const fmtDate = s => new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

  const totalViews     = bookViews.reduce((s, b) => s + b.views, 0)
  const totalDonations = donations.reduce((s, d) => s + Number(d.amount), 0)

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full min-h-screen bg-no-repeat bg-cover bg-center relative text-white"
      style={{
        backgroundImage: `url(${adminDashboardBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">

        {/* Sidebar */}
        <nav className="bg-white/10 backdrop-blur-xl border-b md:border-r border-white/10 md:w-72 md:min-h-screen p-5 flex md:flex-col gap-3">
          {[
            { key: 'home',    label: '🏠 Home'          },
            { key: 'pending', label: '⏳ Pending List'   },
            { key: 'genres',  label: '📚 Genres'         },
            { key: 'users',   label: '👥 Users'          },
            { key: 'views',   label: '📊 Analytics'      },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAdminTab(key)}
              className={`w-full text-left px-5 py-3.5 rounded-xl font-medium transition-all ${
                adminTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-200 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6 md:p-8">

          {/* ── HOME ── */}
          {adminTab === 'home' && (
            <div className="text-center py-12 md:py-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Admin Dashboard
              </h2>
              <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
                Welcome! Review pending books, explore approved titles by genre, manage users, or check platform analytics.
              </p>
            </div>
          )}

          {/* ── PENDING ── */}
          {adminTab === 'pending' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Pending Approvals</h2>
              {loading && <p className="text-gray-300 text-center py-8">Loading…</p>}
              {error   && <p className="text-red-400 text-center py-8">Error: {error}</p>}
              {!loading && !error && pendingBooks.length === 0 && (
                <p className="text-gray-300 text-center py-8">No pending books to approve.</p>
              )}
              {!loading && pendingBooks.length > 0 && (
                <div className="overflow-x-auto bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 text-white/60 text-sm uppercase tracking-wider">
                        <th className="px-6 py-4 text-left">Title</th>
                        <th className="px-6 py-4 text-left hidden sm:table-cell">Genre</th>
                        <th className="px-6 py-4 text-left hidden md:table-cell">Author</th>
                        <th className="px-6 py-4 text-left hidden md:table-cell">Uploaded</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBooks.map(book => (
                        <tr key={book.id} className="border-b border-white/10 hover:bg-white/5 transition">
                          <td className="px-6 py-4 font-medium">{book.title}</td>
                          <td className="px-6 py-4 hidden sm:table-cell text-gray-300">{book.genre || 'Other'}</td>
                          <td className="px-6 py-4 hidden md:table-cell text-gray-300">{authorLabel(book)}</td>
                          <td className="px-6 py-4 hidden md:table-cell text-gray-300">
                            {book.created_at ? fmtDate(book.created_at) : '—'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => approveBook(book.id)}
                                disabled={approvingId === book.id || rejectingId === book.id}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition bg-green-600 hover:bg-green-700 disabled:opacity-50"
                              >
                                {approvingId === book.id ? 'Approving…' : '✓ Approve'}
                              </button>
                              <button
                                onClick={() => rejectBook(book.id)}
                                disabled={approvingId === book.id || rejectingId === book.id}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition bg-red-600 hover:bg-red-700 disabled:opacity-50"
                              >
                                {rejectingId === book.id ? 'Rejecting…' : '✕ Reject'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={fetchPendingBooks} className="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-medium transition">
                Refresh List
              </button>
            </div>
          )}

          {/* ── GENRES ── */}
          {adminTab === 'genres' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Approved Books by Genre</h2>
              <div className="flex flex-wrap gap-3 mb-8 overflow-x-auto pb-2">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-6 py-3 rounded-2xl font-medium transition-all ${
                      selectedGenre === g ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <h3 className="text-2xl font-bold mb-6">{selectedGenre} Books</h3>
              {loading && <p className="text-gray-300 text-center py-8">Loading…</p>}
              {error   && <p className="text-red-400 text-center py-8">Error: {error}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {!loading && !error && filteredApprovedBooks.length === 0 ? (
                  <p className="col-span-full text-center text-gray-300 py-8">No approved books in {selectedGenre} yet.</p>
                ) : (
                  filteredApprovedBooks.map(book => {
                    const coverUrl = book.cover_path
                      ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                      : 'https://placehold.co/300x450?text=No+Cover'
                    return (
                      <div key={book.id} className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition border border-white/10">
                        <img src={coverUrl} alt={book.title} className="w-full h-56 object-cover" />
                        <div className="p-5">
                          <h3 className="font-bold text-lg mb-1 line-clamp-2">{book.title}</h3>
                          <p className="text-sm text-gray-300 mb-4">by {authorLabel(book)}</p>
                          <button onClick={() => openReader(book)} className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-xl transition font-medium">
                            Read Now
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {adminTab === 'users' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Registered Users</h2>
              {loading && <p className="text-gray-300 text-center py-8">Loading…</p>}
              {error   && <p className="text-red-400 text-center py-8">Error: {error}</p>}
              {!loading && !error && users.length === 0 && (
                <p className="text-gray-300 text-center py-8">No users registered yet.</p>
              )}
              {!loading && users.length > 0 && (
                <div className="overflow-x-auto bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-white/10 text-white/60 text-sm uppercase tracking-wider">
                        <th className="px-6 py-4 text-left">Email</th>
                        <th className="px-6 py-4 text-left hidden sm:table-cell">Author Name</th>
                        <th className="px-6 py-4 text-left">Role</th>
                        <th className="px-6 py-4 text-left hidden md:table-cell">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b border-white/10 hover:bg-white/5 transition">
                          <td className="px-6 py-4 text-sm">{user.email}</td>
                          <td className="px-6 py-4 hidden sm:table-cell text-gray-300 text-sm">
                            {user.author_name || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={user.role || 'reader'}
                              onChange={e => updateUserRole(user.id, e.target.value)}
                              disabled={updatingRole === user.id}
                              className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 disabled:opacity-50"
                            >
                              <option value="reader" className="text-black">Reader</option>
                              <option value="author" className="text-black">Author</option>
                              <option value="admin"  className="text-black">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell text-gray-300 text-sm">
                            {user.created_at ? fmtDate(user.created_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={fetchUsers} className="mt-6 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-medium transition">
                Refresh Users
              </button>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {adminTab === 'views' && (
            <div>
              <h2 className="text-3xl font-bold mb-8">Platform Analytics</h2>

              {loading && <p className="text-gray-300 text-center py-8">Loading analytics…</p>}
              {error   && <p className="text-red-400 text-center py-8">Error: {error}</p>}

              {!loading && !error && (
                <div className="space-y-8">

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Books',    value: bookViews.length,               accent: 'text-blue-300'   },
                      { label: 'Total Page Views', value: totalViews.toLocaleString(),  accent: 'text-purple-300' },
                      { label: 'Total Users',    value: users.length || '—',            accent: 'text-green-300'  },
                      { label: 'Platform Donations', value: fmt(totalDonations),        accent: 'text-pink-300'   },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="rounded-2xl p-5 bg-white/10 border border-white/20 backdrop-blur-sm">
                        <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${accent}`}>{label}</p>
                        <p className="text-2xl font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Book views table */}
                  <div>
                    <h3 className="text-xl font-semibold text-white/80 mb-3 border-b border-white/10 pb-2">
                      Books by Page Views
                    </h3>
                    {bookViews.length === 0 ? (
                      <p className="text-gray-400 text-sm py-4">No page views recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-white/10 text-white/60 text-xs uppercase tracking-wider">
                              <th className="px-4 py-3 text-left">#</th>
                              <th className="px-4 py-3 text-left">Title</th>
                              <th className="px-4 py-3 text-left hidden sm:table-cell">Author</th>
                              <th className="px-4 py-3 text-right">Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookViews.map((book, i) => (
                              <tr key={book.id} className={`border-t border-white/10 ${i % 2 === 0 ? 'bg-white/5' : ''} hover:bg-white/10 transition`}>
                                <td className="px-4 py-3 text-white/40">{i + 1}</td>
                                <td className="px-4 py-3 text-white font-medium">{book.title}</td>
                                <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{book.author_name || '—'}</td>
                                <td className="px-4 py-3 text-right text-purple-300 font-semibold">{book.views.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Platform donations */}
                  <div>
                    <h3 className="text-xl font-semibold text-white/80 mb-3 border-b border-white/10 pb-2">
                      Recent Donations (Platform-wide)
                    </h3>
                    {donations.length === 0 ? (
                      <p className="text-gray-400 text-sm py-4">No donations recorded yet.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-white/10 text-white/60 text-xs uppercase tracking-wider">
                              <th className="px-4 py-3 text-left">Amount</th>
                              <th className="px-4 py-3 text-left">Status</th>
                              <th className="px-4 py-3 text-left hidden sm:table-cell">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {donations.map((d, i) => (
                              <tr key={d.id} className={`border-t border-white/10 ${i % 2 === 0 ? 'bg-white/5' : ''} hover:bg-white/10 transition`}>
                                <td className="px-4 py-3 text-pink-300 font-semibold">{fmt(d.amount)}</td>
                                <td className="px-4 py-3 text-green-300">{d.status || '—'}</td>
                                <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{fmtDate(d.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button onClick={fetchBookViews} className="text-sm text-blue-300 hover:text-white transition underline underline-offset-4">
                    ↻ Refresh analytics
                  </button>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Reader modal */}
      {selectedBookForReading && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-900 text-white">
              <h3 className="font-semibold">Reading: {selectedBookForReading.title}</h3>
              <button onClick={closeReader} className="bg-gray-700 hover:bg-gray-600 px-5 py-2 rounded-lg transition">
                Close
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[80vh]">
              <SecureReader book={selectedBookForReading} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}