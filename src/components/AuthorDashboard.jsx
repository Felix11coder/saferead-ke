// src/components/AuthorDashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import BookUpload from './BookUpload'

// ─── tiny helpers ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-1 bg-white/10 border border-white/20 backdrop-blur-sm`}>
      <span className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{label}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-gray-300">{sub}</span>}
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-lg font-semibold text-white/80 mb-3 border-b border-white/10 pb-2">
      {children}
    </h3>
  )
}
// ────────────────────────────────────────────────────────────────────────────

export default function AuthorDashboard({
  user,
  authorTab,
  setAuthorTab,
  selectedGenre,
  setSelectedGenre,
  genres,
  filteredBooks,
  openReader,
  authorDashboardBg,
  isSidebarOpen,
  setIsSidebarOpen,
  searchQuery = ""
}) {
  // ── stats state ────────────────────────────────────────────────────────
  const [statsLoading, setStatsLoading] = useState(false)
  const [totalPageViews, setTotalPageViews]   = useState(0)
  const [todayPageViews, setTodayPageViews]   = useState(0)
  const [viewsByBook, setViewsByBook]         = useState([])   // [{title, count}]
  const [donations, setDonations]             = useState([])   // raw rows
  const [totalDonations, setTotalDonations]   = useState(0)
  const [adEarnings, setAdEarnings]           = useState([])   // raw rows
  const [totalAdEarnings, setTotalAdEarnings] = useState(0)
  const [realtimeViews, setRealtimeViews]     = useState(0)    // live counter delta

  // ── fetch stats whenever the Stats tab is opened ───────────────────────
  useEffect(() => {
    if (authorTab !== 'stats' || !user) return
    fetchStats()
    const unsub = subscribeRealtime()
    return () => unsub()
  }, [authorTab, user])

  async function fetchStats() {
    setStatsLoading(true)
    const uid = user.id

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ── 1. Page views ──────────────────────────────────────────────────
    const { data: pvData } = await supabase
      .from('page_views')
      .select('book_id, viewed_at, books(title)')
      .eq('author_id', uid)

    if (pvData) {
      setTotalPageViews(pvData.length)
      setTodayPageViews(pvData.filter(r => new Date(r.viewed_at) >= today).length)

      // group by book title
      const map = {}
      pvData.forEach(r => {
        const title = r.books?.title ?? r.book_id
        map[title] = (map[title] ?? 0) + 1
      })
      setViewsByBook(
        Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([title, count]) => ({ title, count }))
      )
    }

    // ── 2. Donations ───────────────────────────────────────────────────
    const { data: donData } = await supabase
      .from('donations')
      .select('id, amount, created_at, book_id, status')
      .eq('author_id', uid)
      .order('created_at', { ascending: false })
      .limit(10)

    if (donData) {
      setDonations(donData)
      setTotalDonations(donData.reduce((s, r) => s + Number(r.amount), 0))
    }

    // ── 3. Ad earnings ─────────────────────────────────────────────────
    const { data: aeData } = await supabase
      .from('ad_earnings')
      .select('id, gross_kes, author_share, period_start, period_end, books(title)')
      .eq('author_id', uid)
      .order('period_end', { ascending: false })
      .limit(6)

    if (aeData) {
      setAdEarnings(aeData)
      setTotalAdEarnings(aeData.reduce((s, r) => s + Number(r.author_share), 0))
    }

    setStatsLoading(false)
  }

  // ── Supabase Realtime: live page-view counter ──────────────────────────
  function subscribeRealtime() {
    const channel = supabase
      .channel('live-page-views')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'page_views',
          filter: `author_id=eq.${user.id}`,
        },
        () => {
          setRealtimeViews(v => v + 1)
          setTotalPageViews(v => v + 1)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  // ── format helpers ─────────────────────────────────────────────────────
  const fmt = n => `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  const fmtDate = s => new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })

  // Search filtering
  const q = searchQuery.trim().toLowerCase()
  const searchedBooks = q
    ? filteredBooks.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.author_name?.toLowerCase().includes(q) ||
        b.genre?.toLowerCase().includes(q)
      )
    : filteredBooks

  // ── render ─────────────────────────────────────────────────────────────
  const sidebarItems = [
    { key: 'home',   label: 'Home',    icon: '⌂' },
    { key: 'upload', label: 'Upload',  icon: '↑' },
    { key: 'genres', label: 'Library', icon: '◈' },
    { key: 'stats',  label: 'Stats',   icon: '◉' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#060d08', fontFamily: 'Georgia, serif', position: 'relative' }}>
      {/* Atmospheric bg */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${authorDashboardBg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 15% 60%, rgba(34,197,94,0.06) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(16,185,129,0.04) 0%, transparent 50%)', pointerEvents: 'none' }} />
      <style>{`
        .author-sidebar-toggle { display: none; }
        .author-sidebar { display: flex; }
        @media (max-width: 640px) {
          .author-sidebar-toggle { display: flex !important; }
          .author-sidebar {
            position: fixed !important;
            left: 0; top: 0;
            height: 100vh;
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            width: 220px !important;
          }
          .author-sidebar.open { transform: translateX(0) !important; }
          .author-main { padding: 3.5rem 0.875rem 1rem !important; }
          .author-overlay { display: block !important; }
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex' }}>

        {/* Mobile sidebar backdrop — only rendered when open */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 35 }}
          />
        )}

        {/* Mobile hamburger — only visible when sidebar is CLOSED */}
        {!isSidebarOpen && (
          <button
            className="author-sidebar-toggle"
            onClick={() => setIsSidebarOpen(true)}
            style={{
              alignItems: 'center', justifyContent: 'center',
              position: 'fixed', top: '4rem', left: '0.75rem', zIndex: 50,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: '10px', padding: '0.55rem 0.7rem', color: '#22c55e',
              cursor: 'pointer', fontSize: '1.1rem', backdropFilter: 'blur(10px)',
              lineHeight: 1
            }}>
            ☰
          </button>
        )}

        {/* Sidebar */}
        <nav
          className={`author-sidebar${isSidebarOpen ? ' open' : ''}`}
          style={{ width: '220px', minHeight: '100vh', background: 'rgba(6,13,8,0.97)', borderRight: '1px solid rgba(34,197,94,0.12)', padding: '2rem 1.25rem', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>

          {/* Close button — inside sidebar at the top */}
          <div className="author-sidebar-toggle" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button onClick={() => setIsSidebarOpen(false)} style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px', padding: '0.4rem 0.65rem', color: '#22c55e',
              cursor: 'pointer', fontSize: '1rem', lineHeight: 1
            }}>✕</button>
          </div>

          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(34,197,94,0.12)' }}>
            <p style={{ color: '#22c55e', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>SafeRead KE</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Author Studio</p>
          </div>
          {sidebarItems.map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setAuthorTab(key); setIsSidebarOpen(false) }} style={{
              padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', textAlign: 'left', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', fontFamily: 'Georgia, serif',
              background: authorTab === key ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: authorTab === key ? '#22c55e' : 'rgba(255,255,255,0.45)',
              borderLeft: authorTab === key ? '2px solid #22c55e' : '2px solid transparent', transition: 'all 0.2s'
            }}>
              <span>{icon}</span> {label}
            </button>
          ))}

          {realtimeViews > 0 && (
            <div style={{ marginTop: 'auto', padding: '0.75rem', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ color: '#22c55e', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>+{realtimeViews} live view{realtimeViews !== 1 ? 's' : ''}</p>
            </div>
          )}
        </nav>

        {/* Main */}
        <main className="author-main" style={{ flex: 1, padding: '2.5rem', color: 'white', overflowY: 'auto', minWidth: 0 }}>

          {/* HOME */}
          {authorTab === 'home' && (
            <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✍️</div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#22c55e', marginBottom: '1rem', letterSpacing: '-0.5px' }}>Author Studio</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', maxWidth: '480px', margin: '0 auto 2rem', lineHeight: 1.8 }}>
                Upload your books, track readers, and earn from every page turned.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setAuthorTab('upload')} style={{ padding: '0.875rem 2rem', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white', fontFamily: 'Georgia, serif', fontSize: '0.95rem', cursor: 'pointer' }}>Upload a Book</button>
                <button onClick={() => setAuthorTab('stats')} style={{ padding: '0.875rem 2rem', borderRadius: '50px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontFamily: 'Georgia, serif', fontSize: '0.95rem', cursor: 'pointer' }}>View Stats</button>
              </div>
            </div>
          )}

          {/* UPLOAD */}
          {authorTab === 'upload' && (
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '1.75rem', color: '#22c55e', marginBottom: '0.5rem' }}>Upload New Book</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', marginBottom: '2rem', fontFamily: 'sans-serif' }}>Your book will go live after admin approval.</p>
              <BookUpload user={user} />
            </div>
          )}

          {/* GENRES */}
          {authorTab === 'genres' && (
            <div>
              <h2 style={{ fontSize: '1.75rem', color: '#22c55e', marginBottom: '1.5rem' }}>Your Library</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {genres.map(g => (
                  <button key={g} onClick={() => setSelectedGenre(g)} style={{
                    padding: '0.35rem 0.875rem', borderRadius: '50px', border: selectedGenre === g ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.12)',
                    background: selectedGenre === g ? 'rgba(34,197,94,0.12)' : 'transparent',
                    color: selectedGenre === g ? '#22c55e' : 'rgba(255,255,255,0.4)', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'sans-serif'
                  }}>{g}</button>
                ))}
              </div>
              {searchedBooks.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.55)', padding: '4rem', textAlign: 'center' }}>{q ? `No results for \"{searchQuery}\"` : `No books in ${selectedGenre} yet.`}</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.25rem' }}>
                  {searchedBooks.map(book => {
                    const coverUrl = book.cover_path ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl : 'https://placehold.co/300x450?text=No+Cover'
                    return (
                      <div key={book.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: '14px', overflow: 'hidden' }}>
                        <img src={coverUrl} alt={book.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover' }} />
                        <div style={{ padding: '0.75rem' }}>
                          <h3 style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.95)', fontWeight: 700, marginBottom: '0.25rem', lineHeight: 1.4 }}>{book.title}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.6rem', fontFamily: 'sans-serif' }}>by {book.author_name || 'You'}</p>
                          <button onClick={() => openReader(book)} style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>Read</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* STATS */}
          {authorTab === 'stats' && (
            <div style={{ maxWidth: '900px' }}>
              <h2 style={{ fontSize: '1.75rem', color: '#22c55e', marginBottom: '2rem' }}>Your Stats</h2>
              {statsLoading ? (
                <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '4rem' }}>Loading your stats…</p>
              ) : (
                <div>
                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                      { label: 'Total Page Views', value: totalPageViews.toLocaleString(), sub: 'All time', color: '#22c55e' },
                      { label: "Today's Views", value: todayPageViews.toLocaleString(), sub: new Date().toLocaleDateString('en-KE', { weekday: 'long' }), color: '#34d399' },
                      { label: 'Total Donations', value: fmt(totalDonations), sub: `${donations.length} transaction${donations.length !== 1 ? 's' : ''}`, color: '#86efac' },
                      { label: 'Ad Earnings', value: fmt(totalAdEarnings), sub: '65% of gross', color: '#bbf7d0' },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: '16px', padding: '1.25rem' }}>
                        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>{label}</p>
                        <p style={{ fontSize: '1.75rem', fontWeight: 700, color, marginBottom: '0.25rem' }}>{value}</p>
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', fontFamily: 'sans-serif' }}>{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Total earnings banner */}
                  <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>Estimated Total Earnings</p>
                      <p style={{ fontSize: '2.25rem', fontWeight: 700, color: '#22c55e' }}>{fmt(totalDonations + totalAdEarnings)}</p>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', maxWidth: '280px', fontFamily: 'sans-serif', lineHeight: 1.6 }}>Donations + ad revenue share. Ad payouts processed monthly.</p>
                  </div>

                  {/* Top books */}
                  {viewsByBook.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '1rem', borderBottom: '1px solid rgba(34,197,94,0.1)', paddingBottom: '0.75rem' }}>Top Books by Views</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {viewsByBook.map(({ title, count }, i) => {
                          const pct = Math.round((count / totalPageViews) * 100)
                          return (
                            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem', width: '1rem', fontFamily: 'sans-serif' }}>{i + 1}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.95rem' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</span>
                                  <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>{count.toLocaleString()}</span>
                                </div>
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: '#22c55e', borderRadius: '2px' }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Donations table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif', marginBottom: '1rem', borderBottom: '1px solid rgba(34,197,94,0.1)', paddingBottom: '0.75rem' }}>Recent Donations</h3>
                    {donations.length === 0 ? (
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1rem', fontFamily: 'sans-serif' }}>No donations yet. Share your books!</p>
                    ) : (
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.1)' }}>
                        <table style={{ width: '100%', fontSize: '0.95rem', borderCollapse: 'collapse', fontFamily: 'sans-serif' }}>
                          <thead>
                            <tr style={{ background: 'rgba(34,197,94,0.06)' }}>
                              {['Book', 'Amount', 'Date', 'Status'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'rgba(255,255,255,0.65)', fontWeight: 500, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.1em' }}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {donations.map((d, i) => (
                              <tr key={d.id} style={{ borderTop: '1px solid rgba(34,197,94,0.06)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.6)' }}>{d.book_id ? d.book_id.substring(0, 8) + '…' : '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#22c55e', fontWeight: 600 }}>{fmt(d.amount)}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.65)' }}>{fmtDate(d.created_at)}</td>
                                <td style={{ padding: '0.75rem 1rem', color: 'rgba(255,255,255,0.55)' }}>{d.status || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button onClick={fetchStats} style={{ background: 'none', border: 'none', color: 'rgba(34,197,94,0.6)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'sans-serif', textDecoration: 'underline' }}>↻ Refresh stats</button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )

}