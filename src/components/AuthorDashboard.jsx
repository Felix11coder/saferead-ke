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
  setIsSidebarOpen
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

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="w-full min-h-screen bg-no-repeat bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${authorDashboardBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">
        {/* Mobile toggle */}
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-white/90 p-3 rounded-lg shadow-lg backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>

        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav
          className={`
            bg-white/85 border-b md:border-r md:border-gray-200 
            w-64 min-h-screen p-4 md:p-6 flex md:flex-col gap-3 md:gap-4 backdrop-blur-md
            fixed md:static inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-50
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
            overflow-y-auto
          `}
        >
          {[
            { key: 'home',   label: 'Home'   },
            { key: 'upload', label: 'Upload' },
            { key: 'genres', label: 'Genre'  },
            { key: 'stats',  label: '📊 Stats' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setAuthorTab(key); setIsSidebarOpen(false) }}
              className={`px-5 py-3 rounded-lg font-medium text-left transition-all text-sm md:text-base ${
                authorTab === key
                  ? 'bg-purple-100 text-purple-700 border-l-4 border-purple-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 text-white">

          {/* ── HOME ── */}
          {authorTab === 'home' && (
            <div className="text-center py-8 sm:py-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Author Home</h2>
              <p className="text-base sm:text-lg text-gray-200 max-w-2xl mx-auto">
                Welcome! Use Upload to add new books, or Genre to view your approved titles.
              </p>
            </div>
          )}

          {/* ── UPLOAD ── */}
          {authorTab === 'upload' && (
            <div className="max-w-4xl mx-auto px-2 sm:px-4">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Upload New Book</h2>
              <BookUpload user={user} />
            </div>
          )}

          {/* ── GENRES ── */}
          {authorTab === 'genres' && (
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Your Books by Genre</h2>
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-2">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-4 py-2 sm:px-5 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all whitespace-nowrap ${
                      selectedGenre === g
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'bg-white/90 text-gray-700 hover:bg-gray-200 hover:shadow backdrop-blur-sm'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                {filteredBooks.length === 0 ? (
                  <p className="col-span-full text-center text-base sm:text-lg text-gray-200 py-12">
                    No books in {selectedGenre} yet.
                  </p>
                ) : (
                  filteredBooks.map(book => {
                    const coverUrl = book.cover_path
                      ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                      : 'https://placehold.co/300x450?text=No+Cover'
                    return (
                      <div key={book.id} className="bg-white/90 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition backdrop-blur-sm flex flex-col">
                        <img src={coverUrl} alt={book.title} className="w-full h-44 xs:h-48 sm:h-52 md:h-60 lg:h-64 object-cover" />
                        <div className="p-3 sm:p-4 flex flex-col flex-1">
                          <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 line-clamp-2 text-gray-800">{book.title}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 flex-1">
                            by {book.author_name || 'Unknown Author'}
                          </p>
                          <button onClick={() => openReader(book)} className="mt-auto bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition text-sm sm:text-base font-medium">
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

          {/* ── STATS ── */}
          {authorTab === 'stats' && (
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold">Your Stats</h2>
                {realtimeViews > 0 && (
                  <span className="flex items-center gap-2 bg-green-500/20 border border-green-400/40 text-green-300 text-sm px-3 py-1.5 rounded-full animate-pulse">
                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
                    +{realtimeViews} new view{realtimeViews !== 1 ? 's' : ''} live
                  </span>
                )}
              </div>

              {statsLoading ? (
                <div className="text-center py-20 text-gray-300 text-lg">Loading your stats…</div>
              ) : (
                <div className="space-y-8">

                  {/* ── Summary cards ── */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="Total Page Views"
                      value={totalPageViews.toLocaleString()}
                      sub="All time"
                      accent="text-purple-300"
                    />
                    <StatCard
                      label="Today's Views"
                      value={todayPageViews.toLocaleString()}
                      sub={new Date().toLocaleDateString('en-KE', { weekday: 'long' })}
                      accent="text-blue-300"
                    />
                    <StatCard
                      label="Total Donations"
                      value={fmt(totalDonations)}
                      sub={`${donations.length} transaction${donations.length !== 1 ? 's' : ''}`}
                      accent="text-pink-300"
                    />
                    <StatCard
                      label="Ad Earnings (Your Share)"
                      value={fmt(totalAdEarnings)}
                      sub="65% of gross ad revenue"
                      accent="text-yellow-300"
                    />
                  </div>

                  {/* ── Estimated total earnings ── */}
                  <div className="rounded-2xl bg-gradient-to-r from-purple-800/60 to-pink-800/60 border border-white/20 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 backdrop-blur-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Estimated Total Earnings</p>
                      <p className="text-4xl font-bold text-white">{fmt(totalDonations + totalAdEarnings)}</p>
                    </div>
                    <p className="text-sm text-white/60 max-w-xs">Donations + your share of ad revenue. Ad payouts are processed monthly by the platform.</p>
                  </div>

                  {/* ── Top books by views ── */}
                  {viewsByBook.length > 0 && (
                    <div>
                      <SectionHeading>Top Books by Page Views</SectionHeading>
                      <div className="space-y-3">
                        {viewsByBook.map(({ title, count }, i) => {
                          const pct = Math.round((count / totalPageViews) * 100)
                          return (
                            <div key={title} className="flex items-center gap-4">
                              <span className="text-white/40 text-sm w-5 text-right">{i + 1}</span>
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-white font-medium truncate max-w-xs">{title}</span>
                                  <span className="text-white/60 ml-2 shrink-0">{count.toLocaleString()} views</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-purple-400 transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Donation history ── */}
                  <div>
                    <SectionHeading>Recent Donations</SectionHeading>
                    {donations.length === 0 ? (
                      <p className="text-gray-400 text-sm py-4">No donations yet. Share your books to get reader support!</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/10 text-white/60 text-left uppercase text-xs tracking-wider">
                              <th className="px-4 py-3">Book</th>
                              <th className="px-4 py-3">Amount</th>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3 hidden sm:table-cell">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {donations.map((d, i) => (
                              <tr
                                key={d.id}
                                className={`border-t border-white/10 ${i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10 transition`}
                              >
                                <td className="px-4 py-3 text-white font-medium truncate max-w-[180px]">
                                  {d.book_id ? d.book_id.substring(0, 8) + '…' : '—'}
                                </td>
                                <td className="px-4 py-3 text-pink-300 font-semibold whitespace-nowrap">
                                  {fmt(d.amount)}
                                </td>
                                <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                                  {fmtDate(d.created_at)}
                                </td>
                                <td className="px-4 py-3 text-white/40 text-xs hidden sm:table-cell font-mono">
                                  {d.status ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ── Ad earnings breakdown ── */}
                  <div>
                    <SectionHeading>Ad Revenue (Your Share)</SectionHeading>
                    {adEarnings.length === 0 ? (
                      <p className="text-gray-400 text-sm py-4">No ad earnings recorded yet. Earnings are logged monthly by the platform.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/10 text-white/60 text-left uppercase text-xs tracking-wider">
                              <th className="px-4 py-3">Period</th>
                              <th className="px-4 py-3">Gross</th>
                              <th className="px-4 py-3">Your Share</th>
                              <th className="px-4 py-3 hidden sm:table-cell">Book</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adEarnings.map((e, i) => (
                              <tr
                                key={e.id}
                                className={`border-t border-white/10 ${i % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10 transition`}
                              >
                                <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                                  {fmtDate(e.period_start)} – {fmtDate(e.period_end)}
                                </td>
                                <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                                  {fmt(e.gross_kes)}
                                </td>
                                <td className="px-4 py-3 text-yellow-300 font-semibold whitespace-nowrap">
                                  {fmt(e.author_share)}
                                </td>
                                <td className="px-4 py-3 text-white/60 hidden sm:table-cell truncate max-w-[160px]">
                                  {e.books?.title ?? 'Platform-wide'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={fetchStats}
                    className="text-sm text-purple-300 hover:text-white transition underline underline-offset-4"
                  >
                    ↻ Refresh stats
                  </button>

                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}