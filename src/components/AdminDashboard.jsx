// src/components/AdminDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { supabaseConfig } from '../config'
import SecureReader from './SecureReader'

export default function AdminDashboard({ adminDashboardBg, searchQuery = "" }) {
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
  const [togglingPaid, setTogglingPaid]   = useState(null)
  const [editingPrice, setEditingPrice]   = useState(null)  // bookId being edited
  const [priceInput, setPriceInput]       = useState('')
  const [adminTab, setAdminTab]           = useState('home')
  const [adminMobileOpen, setAdminMobileOpen] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState('Sci-Fi')
  const [selectedBookForReading, setSelectedBookForReading] = useState(null)
  const [payouts, setPayouts]           = useState([])   // per-author donation totals
  const [markingPaid, setMarkingPaid]   = useState(null) // authorId being marked

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
        .select('id, title, genre, author_id, author_name, file_path, cover_path, status, created_at, is_paid, price')
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

  const fetchPayouts = async () => {
    setLoading(true); setError(null)
    try {
      // Authors with mpesa_phone
      const { data: authUsers, error: uErr } = await supabase
        .from('users').select('id, author_name, email, mpesa_phone').eq('role', 'author')
      if (uErr) throw uErr

      // Donations
      const { data: dons } = await supabase.from('donations')
        .select('author_id, amount, status')
      // Book purchase earnings (author gets 70%) — two-step to avoid broken join
      const { data: purchases } = await supabase.from('book_purchases')
        .select('book_id, amount_paid, payout_status')
      const { data: allBooks } = await supabase.from('books').select('id, author_id')
      const bookAuthorMap = {}
      ;(allBooks || []).forEach(b => { bookAuthorMap[b.id] = b.author_id })
      // Ad earnings
      const { data: ads } = await supabase.from('ad_earnings')
        .select('author_id, author_share, payout_status')

      const grouped = {}
      const ensure = (id) => {
        if (!grouped[id]) grouped[id] = {
          donations_pending: 0, donations_paid: 0,
          sales_pending: 0,     sales_paid: 0,
          ads_pending: 0,       ads_paid: 0,
        }
      }

      ;(dons || []).forEach(d => {
        ensure(d.author_id)
        if (d.status === 'paid_out') grouped[d.author_id].donations_paid += Number(d.amount)
        else grouped[d.author_id].donations_pending += Number(d.amount)
      })
      ;(purchases || []).forEach(p => {
        const aid = bookAuthorMap[p.book_id]
        if (!aid) return
        ensure(aid)
        const share = Number(p.amount_paid) * 0.70  // 70% to author
        if (p.payout_status === 'paid_out') grouped[aid].sales_paid += share
        else grouped[aid].sales_pending += share
      })
      ;(ads || []).forEach(a => {
        ensure(a.author_id)
        if (a.payout_status === 'paid_out') grouped[a.author_id].ads_paid += Number(a.author_share)
        else grouped[a.author_id].ads_pending += Number(a.author_share)
      })

      const result = (authUsers || []).map(u => {
        const g = grouped[u.id] || {}
        return {
          ...u,
          donations_pending: g.donations_pending || 0,
          donations_paid:    g.donations_paid    || 0,
          sales_pending:     g.sales_pending     || 0,
          sales_paid:        g.sales_paid        || 0,
          ads_pending:       g.ads_pending       || 0,
          ads_paid:          g.ads_paid          || 0,
          total_pending:     (g.donations_pending || 0) + (g.sales_pending || 0) + (g.ads_pending || 0),
          total_paid:        (g.donations_paid || 0) + (g.sales_paid || 0) + (g.ads_paid || 0),
        }
      }).filter(u => u.total_pending + u.total_paid > 0)
        .sort((a, b) => b.total_pending - a.total_pending)

      setPayouts(result)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const sendMpesaPayout = async (author) => {
    if (!author.mpesa_phone) {
      alert('This author has not provided an M-Pesa number yet.')
      return
    }
    const amount = Math.floor(author.total_pending)
    if (amount < 10) { alert('Minimum payout is KES 10.'); return }
    if (!window.confirm(`Send KES ${amount} to ${author.author_name} (${author.mpesa_phone}) via M-Pesa?`)) return
    setMarkingPaid(author.id)
    try {
      // Call Supabase Edge Function (keeps secret key server-side)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${supabaseConfig.url}/functions/v1/send-payout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            author_name: author.author_name,
            mpesa_phone: author.mpesa_phone,
            amount,
          }),
        }
      )
      const result = await res.json()
      if (!result.success) throw new Error(result.error)

      // Mark everything as paid_out in DB
      await Promise.all([
        supabase.from('donations').update({ status: 'paid_out' }).eq('author_id', author.id).neq('status', 'paid_out'),
        supabase.from('ad_earnings').update({ payout_status: 'paid_out' }).eq('author_id', author.id).neq('payout_status', 'paid_out'),
      ])
      // For book purchases we need to go through books
      const { data: authorBooks } = await supabase.from('books').select('id').eq('author_id', author.id)
      if (authorBooks?.length) {
        const bookIds = authorBooks.map(b => b.id)
        await supabase.from('book_purchases').update({ payout_status: 'paid_out' }).in('book_id', bookIds).neq('payout_status', 'paid_out')
      }

      alert(`✅ KES ${amount} sent to ${author.mpesa_phone} successfully!`)
      fetchPayouts()
    } catch (err) { alert('Payout failed: ' + err.message) }
    finally { setMarkingPaid(null) }
  }

  useEffect(() => {
    if (adminTab === 'pending') fetchPendingBooks()
    else if (adminTab === 'genres') fetchApprovedBooks()
    else if (adminTab === 'users') fetchUsers()
    else if (adminTab === 'views') fetchBookViews()
    else if (adminTab === 'payouts') fetchPayouts()
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

  const togglePaidStatus = async (bookId, currentIsPaid, currentPrice) => {
    setTogglingPaid(bookId)
    const newIsPaid = !currentIsPaid
    try {
      const { error } = await supabase
        .from('books')
        .update({ is_paid: newIsPaid, price: newIsPaid ? (currentPrice || 0) : 0 })
        .eq('id', bookId)
      if (error) throw error
      setApprovedBooks(prev => prev.map(b =>
        b.id === bookId ? { ...b, is_paid: newIsPaid, price: newIsPaid ? (currentPrice || 0) : 0 } : b
      ))
      // Auto-open price editor when switching TO paid
      if (newIsPaid) {
        setEditingPrice(bookId)
        setPriceInput(currentPrice || '')
      } else {
        // Close editor if switching back to free
        if (editingPrice === bookId) {
          setEditingPrice(null)
          setPriceInput('')
        }
      }
    } catch (err) { alert('Failed to update: ' + err.message) }
    finally { setTogglingPaid(null) }
  }

  const savePrice = async (bookId) => {
    const price = Number(priceInput)
    if (!price || price < 1) { alert('Please enter a valid price.'); return }
    try {
      const { error } = await supabase
        .from('books')
        .update({ price })
        .eq('id', bookId)
      if (error) throw error
      setApprovedBooks(prev => prev.map(b => b.id === bookId ? { ...b, price } : b))
      setEditingPrice(null)
      setPriceInput('')
    } catch (err) { alert('Failed to save price: ' + err.message) }
  }
  const openReader = (book) => setSelectedBookForReading(book)
  const closeReader = () => setSelectedBookForReading(null)

  const deleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Delete user ${userEmail}? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw error
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) { alert('Delete failed: ' + err.message) }
  }

  const deleteBook = async (bookId, bookTitle) => {
    if (!window.confirm(`Delete "${bookTitle}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('books').delete().eq('id', bookId)
      if (error) throw error
      setApprovedBooks(prev => prev.filter(b => b.id !== bookId))
    } catch (err) { alert('Delete failed: ' + err.message) }
  }

  const filteredApprovedBooks = approvedBooks.filter(b => b.genre === selectedGenre)
  const authorLabel = (book) => book.author_name || (book.author_id ? book.author_id.substring(0, 8) + '…' : 'Unknown')
  const fmt = n => `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  const fmtDate = s => new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

  const totalViews     = bookViews.reduce((s, b) => s + b.views, 0)
  const totalDonations = donations.reduce((s, d) => s + Number(d.amount), 0)

  // Search filtering
  const q = searchQuery.trim().toLowerCase()
  const searchedPending  = q ? pendingBooks.filter(b => b.title?.toLowerCase().includes(q) || b.author_name?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q)) : pendingBooks
  const searchedApproved = q ? filteredApprovedBooks.filter(b => b.title?.toLowerCase().includes(q) || b.author_name?.toLowerCase().includes(q) || b.genre?.toLowerCase().includes(q)) : filteredApprovedBooks
  const searchedUsers    = q ? users.filter(u => u.email?.toLowerCase().includes(q) || u.author_name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)) : users


  // ── Render ─────────────────────────────────────────────────────────────
  const navItems = [
    { key: 'home',    label: 'Overview',  icon: '◈' },
    { key: 'pending', label: 'Pending',   icon: '◉' },
    { key: 'genres',  label: 'Catalogue', icon: '▦' },
    { key: 'users',   label: 'Members',   icon: '◎' },
    { key: 'views',   label: 'Analytics', icon: '▲' },
    { key: 'payouts',  label: 'Payouts',   icon: '₭' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0d', fontFamily: "'Georgia', serif", position: 'relative' }}>
      {/* Atmospheric bg */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${adminDashboardBg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.08, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.06) 0%, transparent 55%)', pointerEvents: 'none' }} />
      <style>{`
        .admin-sidebar-toggle { display: none; }
        .admin-sidebar { display: flex; }
        @media (max-width: 640px) {
          .admin-sidebar-toggle { display: flex !important; }
          .admin-sidebar {
            position: fixed !important;
            left: 0; top: 0;
            height: 100vh;
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            width: 220px !important;
          }
          .admin-sidebar.open { transform: translateX(0) !important; }
          .admin-main { padding: 3.5rem 0.875rem 1rem !important; }
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex' }}>

        {/* Mobile sidebar backdrop — only rendered when open */}
        {adminMobileOpen && (
          <div
            onClick={() => setAdminMobileOpen(false)}
            style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 35 }}
          />
        )}

        {/* Mobile hamburger — only visible when sidebar is CLOSED */}
        {!adminMobileOpen && (
          <button
            className="admin-sidebar-toggle"
            onClick={() => setAdminMobileOpen(true)}
            style={{
              alignItems: 'center', justifyContent: 'center',
              position: 'fixed', top: '4rem', left: '0.75rem', zIndex: 50,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px', padding: '0.55rem 0.7rem', color: 'white',
              cursor: 'pointer', fontSize: '1.1rem', backdropFilter: 'blur(10px)',
              lineHeight: 1
            }}>
            ☰
          </button>
        )}

        {/* Sidebar */}
        <nav
          className={`admin-sidebar${adminMobileOpen ? ' open' : ''}`}
          style={{ width: '200px', minHeight: '100vh', background: 'rgba(10,11,13,0.98)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1rem', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>

          {/* Close button — inside sidebar at the top */}
          <div className="admin-sidebar-toggle" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button onClick={() => setAdminMobileOpen(false)} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', padding: '0.4rem 0.65rem', color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '1rem', lineHeight: 1
            }}>✕</button>
          </div>

          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.4rem', fontFamily: 'sans-serif' }}>SafeRead KE</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>Admin Console</p>
          </div>
          {navItems.map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setAdminTab(key); setAdminMobileOpen(false) }} style={{
              padding: '0.65rem 0.875rem', borderRadius: '8px', border: 'none', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.95rem', fontFamily: 'Georgia, serif',
              background: adminTab === key ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: adminTab === key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              borderLeft: adminTab === key ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent', transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{icon}</span> {label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main className="admin-main" style={{ flex: 1, padding: '2.5rem', color: 'white', overflowY: 'auto', minWidth: 0 }}>

          {/* HOME */}
          {adminTab === 'home' && (
            <div style={{ paddingTop: '3rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.75rem' }}>Admin Console</p>
              <h2 style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '1.5rem', color: 'rgba(255,255,255,0.9)', letterSpacing: '-1px' }}>SafeRead KE</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', maxWidth: '480px', lineHeight: 1.8, fontFamily: 'sans-serif' }}>
                Review submissions, manage the catalogue, oversee members, and track platform performance.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '3rem', maxWidth: '600px' }}>
                {[
                  { label: 'Pending Review', action: () => setAdminTab('pending') },
                  { label: 'View Catalogue', action: () => setAdminTab('genres') },
                  { label: 'Manage Members', action: () => setAdminTab('users') },
                  { label: 'Analytics', action: () => setAdminTab('views') },
                ].map(({ label, action }) => (
                  <button key={label} onClick={action} style={{ padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'white', fontWeight: 600, fontFamily: 'Georgia, serif', fontSize: '0.95rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}>
                    {label} →
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PENDING */}
          {adminTab === 'pending' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Review Queue</p>
                <h2 style={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.85)' }}>Pending Approvals</h2>
              </div>
              {loading && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: '1rem' }}>Loading…</p>}
              {error && <p style={{ color: '#f87171', fontFamily: 'sans-serif', fontSize: '1rem' }}>Error: {error}</p>}
              {!loading && !error && searchedPending.length === 0 && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif' }}>{q ? `No results for "${searchQuery}"` : 'No pending submissions.'}</p>}
              {!loading && searchedPending.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', fontFamily: 'sans-serif' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Title', 'Genre', 'Author', 'Date', 'Actions'].map(h => <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', color: 'rgba(255,255,255,0.55)', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.1em' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {searchedPending.map((book, i) => (
                        <tr key={book.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.95)', fontWeight: 600, fontFamily: 'Georgia, serif' }}>{book.title}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.7)' }}>{book.genre || 'Other'}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.7)' }}>{authorLabel(book)}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.85)' }}>{book.created_at ? fmtDate(book.created_at) : '—'}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button onClick={() => approveBook(book.id)} disabled={approvingId === book.id} style={{ padding: '0.4rem 0.875rem', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                                {approvingId === book.id ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => rejectBook(book.id)} disabled={rejectingId === book.id} style={{ padding: '0.4rem 0.875rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                                {rejectingId === book.id ? '…' : 'Reject'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={fetchPendingBooks} style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>Refresh</button>
            </div>
          )}

          {/* GENRES */}
          {adminTab === 'genres' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Catalogue</p>
                <h2 style={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.85)' }}>Approved Books</h2>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
                {genres.map(g => (
                  <button key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '0.3rem 0.75rem', borderRadius: '50px', border: selectedGenre === g ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.08)', background: selectedGenre === g ? 'rgba(255,255,255,0.1)' : 'transparent', color: selectedGenre === g ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>{g}</button>
                ))}
              </div>
              {loading && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: '1rem' }}>Loading…</p>}
              {error && <p style={{ color: '#f87171', fontFamily: 'sans-serif', fontSize: '1rem' }}>Error: {error}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.25rem' }}>
                {!loading && !error && searchedApproved.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.55)', gridColumn: '1/-1', fontFamily: 'sans-serif', fontSize: '1rem' }}>{q ? `No results for "${searchQuery}"` : `No books in ${selectedGenre}.`}</p>
                ) : searchedApproved.map(book => {
                  const coverUrl = book.cover_path ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl : 'https://placehold.co/300x450?text=No+Cover'
                  return (
                    <div key={book.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
                      <img src={coverUrl} alt={book.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} />
                      <div style={{ padding: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', marginBottom: '0.2rem', fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>{book.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>by {authorLabel(book)}</p>

                        {/* Paid toggle */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'sans-serif', color: book.is_paid ? '#fbbf24' : '#22c55e', fontWeight: 600 }}>{book.is_paid ? `KES ${book.price}` : 'FREE'}</span>
                          <button onClick={() => togglePaidStatus(book.id, book.is_paid, book.price)} disabled={togglingPaid === book.id} style={{ padding: '0.2rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                            {togglingPaid === book.id ? '…' : book.is_paid ? 'Free' : 'Paid'}
                          </button>
                        </div>

                        {book.is_paid && (
                          editingPrice === book.id ? (
                            <div style={{ marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '6px', padding: '0.25rem 0.4rem', marginBottom: '0.3rem' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>KES</span>
                                <input
                                  type="number"
                                  value={priceInput}
                                  onChange={e => setPriceInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') savePrice(book.id) }}
                                  placeholder="0"
                                  autoFocus
                                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'white', fontSize: '0.9rem', outline: 'none', fontWeight: 600 }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={() => savePrice(book.id)} style={{ flex: 1, padding: '0.3rem', borderRadius: '5px', border: 'none', background: '#22c55e', color: '#0a0b0d', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>Save ✓</button>
                                <button onClick={() => { setEditingPrice(null); setPriceInput('') }} style={{ padding: '0.3rem 0.5rem', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', cursor: 'pointer' }}>✕</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingPrice(book.id); setPriceInput(book.price || '') }} style={{ width: '100%', padding: '0.3rem', borderRadius: '5px', border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.06)', color: '#fbbf24', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'sans-serif', marginBottom: '0.4rem' }}>
                              ✏ Set price
                            </button>
                          )
                        )}
                        <button onClick={() => openReader(book)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'sans-serif', marginBottom: '0.4rem' }}>Read</button>
                        <button onClick={() => deleteBook(book.id, book.title)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>Delete Book</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* USERS */}
          {adminTab === 'users' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Members</p>
                <h2 style={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.85)' }}>Registered Users</h2>
              </div>
              {loading && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: '1rem' }}>Loading…</p>}
              {!loading && searchedUsers.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', fontFamily: 'sans-serif' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Email', 'Name', 'Role', 'Joined', 'Action'].map(h => <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', color: 'rgba(255,255,255,0.55)', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.78rem', letterSpacing: '0.1em' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {searchedUsers.map((user, i) => (
                        <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.85)' }}>{user.email}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.7)' }}>{user.author_name || '—'}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <select value={user.role || 'reader'} onChange={e => updateUserRole(user.id, e.target.value)} disabled={updatingRole === user.id} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)', borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}>
                              <option value="reader" style={{ background: '#0a0b0d' }}>Reader</option>
                              <option value="author" style={{ background: '#0a0b0d' }}>Author</option>
                              <option value="admin" style={{ background: '#0a0b0d' }}>Admin</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'rgba(255,255,255,0.55)' }}>{user.created_at ? fmtDate(user.created_at) : '—'}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <button onClick={() => deleteUser(user.id, user.email)} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)', color: '#f87171', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={fetchUsers} style={{ marginTop: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>Refresh</button>
            </div>
          )}

          {/* ANALYTICS */}
          {adminTab === 'views' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Analytics</p>
                <h2 style={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.85)' }}>Platform Overview</h2>
              </div>
              {loading && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif', fontSize: '1rem' }}>Loading analytics…</p>}
              {!loading && !error && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                    {[
                      { label: 'Total Books', value: bookViews.length, color: 'rgba(255,255,255,0.85)' },
                      { label: 'Page Views', value: totalViews.toLocaleString(), color: 'rgba(255,255,255,0.85)' },
                      { label: 'Users', value: users.length || '—', color: 'rgba(255,255,255,0.85)' },
                      { label: 'Donations', value: fmt(totalDonations), color: '#22c55e' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem' }}>
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>{label}</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {bookViews.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'sans-serif', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>Books by Page Views</h3>
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', fontFamily: 'sans-serif' }}>
                          <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {['#', 'Title', 'Author', 'Views'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'rgba(255,255,255,0.55)', fontWeight: 500, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {bookViews.map((book, i) => (
                              <tr key={book.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.5)' }}>{i + 1}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'Georgia, serif' }}>{book.title}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.65)' }}>{book.author_name || '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{book.views.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {donations.length > 0 && (
                    <div>
                      <h3 style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'sans-serif', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>Recent Donations</h3>
                      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', fontFamily: 'sans-serif' }}>
                          <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {['Amount', 'Status', 'Date'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'rgba(255,255,255,0.55)', fontWeight: 500, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {donations.map((d, i) => (
                              <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '0.75rem 1rem', color: '#22c55e', fontWeight: 600 }}>{fmt(d.amount)}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.7)' }}>{d.status || '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.85)' }}>{fmtDate(d.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button onClick={fetchBookViews} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'sans-serif', textDecoration: 'underline' }}>↻ Refresh analytics</button>
                </div>
              )}
            </div>
          )}
          {/* PAYOUTS */}
          {adminTab === 'payouts' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Author Payouts</p>
                <h2 style={{ fontSize: '1.75rem', color: 'rgba(255,255,255,0.85)' }}>Earnings Disbursements</h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', fontFamily: 'sans-serif', marginTop: '0.5rem', maxWidth: '580px', lineHeight: 1.6 }}>
                  Each author card shows earnings from <strong style={{color:'rgba(255,255,255,0.6)'}}>donations</strong>, <strong style={{color:'rgba(255,255,255,0.6)'}}>book sales (70% share)</strong>, and <strong style={{color:'rgba(255,255,255,0.6)'}}>ad revenue</strong>. Click <em>Send via M-Pesa</em> to initiate a direct Paystack transfer to their phone.
                </p>
              </div>

              {loading && <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif' }}>Loading…</p>}
              {error && <p style={{ color: '#f87171', fontFamily: 'sans-serif' }}>Error: {error}</p>}
              {!loading && payouts.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'sans-serif', padding: '3rem', textAlign: 'center' }}>No author earnings recorded yet.</p>
              )}

              {!loading && payouts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '760px' }}>
                  {payouts.map(author => (
                    <div key={author.id} style={{ background: 'rgba(255,255,255,0.02)', border: author.total_pending > 0 ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(34,197,94,0.15)', borderRadius: '16px', padding: '1.5rem' }}>

                      {/* Author header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div>
                          <p style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, marginBottom: '0.2rem' }}>{author.author_name || 'Unknown Author'}</p>
                          <p style={{ fontFamily: 'sans-serif', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{author.email}</p>
                          <p style={{ fontFamily: 'sans-serif', fontSize: '0.8rem', marginTop: '0.2rem', color: author.mpesa_phone ? '#22c55e' : '#f87171' }}>
                            {author.mpesa_phone ? '📱 ' + author.mpesa_phone : '⚠️ No M-Pesa number on file'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '0.25rem' }}>Total Pending</p>
                          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: author.total_pending > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif' }}>{fmt(author.total_pending)}</p>
                        </div>
                      </div>

                      {/* Breakdown grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        {[
                          { label: 'Donations', pending: author.donations_pending, paid: author.donations_paid, color: '#d4af37' },
                          { label: 'Book Sales (70%)', pending: author.sales_pending, paid: author.sales_paid, color: '#a78bfa' },
                          { label: 'Ad Revenue', pending: author.ads_pending, paid: author.ads_paid, color: '#34d399' },
                        ].map(({ label, pending, paid, color }) => (
                          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.875rem' }}>
                            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'sans-serif', marginBottom: '0.4rem' }}>{label}</p>
                            <p style={{ fontSize: '0.95rem', fontWeight: 700, color, fontFamily: 'sans-serif' }}>{fmt(pending)}</p>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'sans-serif', marginTop: '0.2rem' }}>paid: {fmt(paid)}</p>
                          </div>
                        ))}
                      </div>

                      {/* Action */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {author.total_pending > 0 ? (
                          <button
                            onClick={() => sendMpesaPayout(author)}
                            disabled={markingPaid === author.id}
                            style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', fontSize: '0.875rem', fontWeight: 700, cursor: markingPaid === author.id ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', opacity: markingPaid === author.id ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {markingPaid === author.id ? '⏳ Sending…' : '📱 Send ' + fmt(author.total_pending) + ' via M-Pesa'}
                          </button>
                        ) : (
                          <span style={{ padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontSize: '0.8rem', fontFamily: 'sans-serif' }}>✓ All earnings paid out</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={fetchPayouts} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'sans-serif', textDecoration: 'underline' }}>↻ Refresh</button>
            </div>
          )}

        </main>
      </div>

      {/* Reader modal */}
      {selectedBookForReading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0a0b0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', color: 'white', fontWeight: 600, fontFamily: 'Georgia, serif' }}>{selectedBookForReading.title}</h3>
              <button onClick={closeReader} style={{ padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '0.95rem' }}>Close</button>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 60px)' }}>
              <SecureReader book={selectedBookForReading} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}