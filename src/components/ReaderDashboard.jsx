// src/components/ReaderDashboard.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const PAYSTACK_PUBLIC_KEY = 'pk_test_dd44a501f23959e357cb807c2cd0dca4840a8a90'
const PRESET_AMOUNTS = [50, 100, 200, 500]

// ─── Load Paystack script and resolve when ready ──────────────────────────────
function loadPaystack() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop)
    const existing = document.getElementById('paystack-script')
    if (existing) {
      // Script tag exists but may still be loading — poll
      const poll = setInterval(() => {
        if (window.PaystackPop) { clearInterval(poll); resolve(window.PaystackPop) }
      }, 100)
      setTimeout(() => { clearInterval(poll); reject(new Error('Paystack load timeout')) }, 10000)
      return
    }
    const script = document.createElement('script')
    script.id  = 'paystack-script'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => {
      if (window.PaystackPop) resolve(window.PaystackPop)
      else reject(new Error('PaystackPop not found after load'))
    }
    script.onerror = () => reject(new Error('Failed to load Paystack script'))
    document.body.appendChild(script)
  })
}

// ─── Donate modal ─────────────────────────────────────────────────────────────
function DonateModal({ book, readerEmail, onClose }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom]     = useState('')
  const [paying, setPaying]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')

  const effectiveAmount = custom !== '' ? Number(custom) : selected

  const handlePay = async () => {
    setError('')

    if (!effectiveAmount || effectiveAmount < 10) {
      setError('Minimum donation is KES 10.')
      return
    }

    // Ensure we have a valid email — Paystack requires it
    const email = readerEmail || 'donor@safereadke.com'

    setPaying(true)

    try {
      const PaystackPop = await loadPaystack()

      const handler = PaystackPop.setup({
        key:      PAYSTACK_PUBLIC_KEY,
        email,
        amount:   effectiveAmount * 100,   // in kobo
        currency: 'KES',
        ref:      'SAFEREAD_' + Date.now(),
        metadata: {
          custom_fields: [
            { display_name: 'Book',   variable_name: 'book_title', value: book.title },
            { display_name: 'Author', variable_name: 'author_id',  value: book.author_id },
          ]
        },
        callback: (response) => {
          // Paystack v1 requires a plain (non-async) callback
          // Fire-and-forget the Supabase insert
          supabase.from('donations').insert({
            book_id:     book.id,
            author_id:   book.author_id,
            amount:    effectiveAmount,
            status:    'completed',
          }).then(({ error }) => {
            if (error) console.warn('Donation log failed:', error.message)
          })
          setPaying(false)
          setSuccess(true)
        },
        onClose: () => {
          setPaying(false)
        },
      })

      handler.openIframe()

    } catch (err) {
      setPaying(false)
      setError('Could not connect to Paystack: ' + err.message)
    }
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Thank you!</h3>
          <p className="text-gray-600 mb-6">
            Your donation of <strong>KES {effectiveAmount}</strong> to{' '}
            <strong>{book.author_name || 'the author'}</strong> was successful.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition"
          >
            Back to Books
          </button>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl">

        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Support the Author</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {book.author_name || 'Unknown Author'} · <em>{book.title}</em>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">
            ×
          </button>
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
          Choose an amount (KES)
        </p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESET_AMOUNTS.map(amt => (
            <button
              key={amt}
              onClick={() => { setSelected(amt); setCustom('') }}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                selected === amt && custom === ''
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 text-gray-700 hover:border-blue-400'
              }`}
            >
              {amt}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
          Or enter a custom amount
        </p>
        <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden mb-5 focus-within:border-blue-500 transition">
          <span className="px-3 text-gray-500 font-medium bg-gray-50 py-3">KES</span>
          <input
            type="number"
            min="10"
            placeholder="e.g. 250"
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected(null) }}
            className="flex-1 px-3 py-3 text-gray-800 focus:outline-none"
          />
        </div>

        {effectiveAmount > 0 && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700 font-medium">
            Donating <strong>KES {effectiveAmount}</strong> to {book.author_name || 'this author'}
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">⚠️ {error}</p>}

        <button
          onClick={handlePay}
          disabled={paying || !effectiveAmount}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition"
        >
          {paying ? 'Opening Paystack…' : `Donate KES ${effectiveAmount || '—'}`}
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">
          Secured by Paystack · M-Pesa, cards &amp; bank transfer accepted
        </p>
      </div>
    </div>
  )
}

// ─── Main ReaderDashboard ─────────────────────────────────────────────────────
export default function ReaderDashboard({
  readerTab,
  setReaderTab,
  selectedGenre,
  setSelectedGenre,
  genres,
  filteredBooks,
  openReader,
  readerDashboardBg,
  isSidebarOpen,
  setIsSidebarOpen
}) {
  const [donatingBook, setDonatingBook] = useState(null)
  const [readerEmail, setReaderEmail]   = useState('')

  // Preload Paystack script immediately on mount
  useEffect(() => { loadPaystack().catch(() => {}) }, [])

  // Get reader email
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setReaderEmail(data.user.email)
    })
  }, [])

  return (
    <div
      className="w-full min-h-screen bg-no-repeat bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${readerDashboardBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 min-h-screen flex flex-col md:flex-row">

        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-white/90 p-3 rounded-lg shadow-lg backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>

        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />
        )}

        <nav className={`
          bg-white/85 border-b md:border-r md:border-gray-200
          w-64 min-h-screen p-5 md:p-6 flex md:flex-col gap-3 md:gap-4 backdrop-blur-md
          fixed md:static inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-50
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          overflow-y-auto
        `}>
          {[
            { key: 'home',   label: 'Home'  },
            { key: 'genres', label: 'Genre' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setReaderTab(key); setIsSidebarOpen(false) }}
              className={`px-5 py-3 rounded-lg font-medium text-left transition-all text-sm md:text-base ${
                readerTab === key
                  ? 'bg-blue-100 text-blue-700 border-l-4 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 md:p-8">

          {readerTab === 'home' && (
            <div className="text-center py-8 sm:py-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-white">Home</h2>
              <p className="text-base sm:text-lg text-gray-200 max-w-2xl mx-auto">
                Welcome! Browse genres to find books, then support your favourite authors with a donation.
              </p>
            </div>
          )}

          {readerTab === 'genres' && (
            <div>
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-2">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGenre(g)}
                    className={`px-4 py-2 sm:px-5 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all whitespace-nowrap ${
                      selectedGenre === g
                        ? 'bg-blue-600 text-white shadow-md scale-105'
                        : 'bg-white/90 text-blue-600 hover:bg-blue-200 hover:shadow backdrop-blur-sm'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center text-white">
                {selectedGenre} Books
              </h2>

              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                {filteredBooks.length === 0 ? (
                  <p className="col-span-full text-center text-base sm:text-lg text-gray-200 py-12">
                    No books in {selectedGenre} yet.
                  </p>
                ) : (
                  filteredBooks.map(book => {
                    const coverUrl = book.cover_path
                      ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                      : 'https://placehold.co/200x300?text=No+Cover'

                    return (
                      <div
                        key={book.id}
                        className="bg-white/90 rounded-xl shadow-md overflow-hidden hover:shadow-xl transition backdrop-blur-sm flex flex-col"
                      >
                        <img
                          src={coverUrl}
                          alt={book.title}
                          className="w-full h-44 xs:h-48 sm:h-52 md:h-60 lg:h-64 object-cover"
                        />
                        <div className="p-3 sm:p-4 flex flex-col flex-1">
                          <h3 className="font-bold text-base sm:text-lg mb-1 line-clamp-2 text-gray-800">
                            {book.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-gray-500 mb-3 flex-1">
                            by {book.author_name || 'Unknown Author'}
                          </p>
                          <button
                            onClick={() => openReader(book)}
                            className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition text-sm font-medium mb-2"
                          >
                            Read Now
                          </button>
                          <button
                            onClick={() => setDonatingBook(book)}
                            className="bg-white text-blue-600 border-2 border-blue-500 py-2 px-4 rounded-lg hover:bg-blue-50 transition text-sm font-medium"
                          >
                            ❤️ Support Author
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {donatingBook && (
        <DonateModal
          book={donatingBook}
          readerEmail={readerEmail}
          onClose={() => setDonatingBook(null)}
        />
      )}
    </div>
  )
}