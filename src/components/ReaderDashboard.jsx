// src/components/ReaderDashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const PAYSTACK_PUBLIC_KEY = 'pk_test_dd44a501f23959e357cb807c2cd0dca4840a8a90'
const PRESET_AMOUNTS = [50, 100, 200, 500]

function loadPaystack() {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve(window.PaystackPop)
    const existing = document.getElementById('paystack-script')
    if (existing) {
      const poll = setInterval(() => {
        if (window.PaystackPop) { clearInterval(poll); resolve(window.PaystackPop) }
      }, 100)
      setTimeout(() => { clearInterval(poll); reject(new Error('Paystack load timeout')) }, 10000)
      return
    }
    const script = document.createElement('script')
    script.id = 'paystack-script'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => window.PaystackPop ? resolve(window.PaystackPop) : reject(new Error('PaystackPop not found'))
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.body.appendChild(script)
  })
}

function DonateModal({ book, readerEmail, onClose }) {
  const [selected, setSelected] = useState(null)
  const [custom, setCustom] = useState('')
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const effectiveAmount = custom !== '' ? Number(custom) : selected

  const handlePay = async () => {
    setError('')
    if (!effectiveAmount || effectiveAmount < 10) { setError('Minimum donation is KES 10.'); return }
    setPaying(true)
    try {
      const PaystackPop = await loadPaystack()
      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, email: readerEmail || 'donor@safereadke.com',
        amount: effectiveAmount * 100, currency: 'KES', ref: 'SAFEREAD_' + Date.now(),
        metadata: { custom_fields: [{ display_name: 'Book', variable_name: 'book_title', value: book.title }] },
        callback: (response) => {
          supabase.from('donations').insert({ book_id: book.id, author_id: book.author_id, amount: effectiveAmount, status: 'completed' })
            .then(({ error }) => { if (error) console.warn('Donation log failed:', error.message) })
          setPaying(false); setSuccess(true)
        },
        onClose: () => setPaying(false),
      })
      handler.openIframe()
    } catch (err) { setPaying(false); setError('Could not connect to Paystack: ' + err.message) }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }
  const modalStyle = { background: '#1a1208', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '20px', padding: '2rem', maxWidth: '380px', width: '100%', color: 'white' }

  if (success) return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: '0.5rem' }}>Thank you!</h3>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', marginBottom: '1.5rem' }}>
          Your donation of <strong style={{ color: '#d4af37' }}>KES {effectiveAmount}</strong> to <strong>{book.author_name || 'the author'}</strong> was successful.
        </p>
        <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b8860b)', color: '#1a1208', fontWeight: 700, cursor: 'pointer' }}>Back to Books</button>
      </div>
    </div>
  )

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Support the Author</h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem' }}>{book.author_name || 'Unknown'} · <em>{book.title}</em></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Choose an amount (KES)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {PRESET_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => { setSelected(amt); setCustom('') }} style={{
              padding: '0.6rem', borderRadius: '10px', border: selected === amt && custom === '' ? '2px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
              background: selected === amt && custom === '' ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              color: selected === amt && custom === '' ? '#d4af37' : 'white', fontWeight: 600, fontSize: '1rem', cursor: 'pointer'
            }}>{amt}</button>
          ))}
        </div>
        <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
          <span style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '1rem', borderRight: '1px solid rgba(255,255,255,0.1)' }}>KES</span>
          <input type="number" min="10" placeholder="Custom amount" value={custom} onChange={e => { setCustom(e.target.value); setSelected(null) }}
            style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: 'none', color: 'white', fontSize: '1rem', outline: 'none' }} />
        </div>
        {effectiveAmount > 0 && <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem', fontSize: '1rem', color: '#d4af37' }}>Donating KES {effectiveAmount} to {book.author_name || 'this author'}</div>}
        {error && <p style={{ color: '#f87171', fontSize: '1rem', marginBottom: '0.75rem' }}>⚠️ {error}</p>}
        <button onClick={handlePay} disabled={paying || !effectiveAmount} style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none', background: paying || !effectiveAmount ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #d4af37, #b8860b)', color: paying || !effectiveAmount ? 'rgba(255,255,255,0.3)' : '#1a1208', fontWeight: 700, fontSize: '0.95rem', cursor: paying || !effectiveAmount ? 'not-allowed' : 'pointer', marginBottom: '0.75rem' }}>
          {paying ? 'Opening Paystack…' : `Donate KES ${effectiveAmount || '—'}`}
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)' }}>Secured by Paystack · M-Pesa, cards & bank transfer</p>
      </div>
    </div>
  )
}

export default function ReaderDashboard({ user, readerTab, setReaderTab, selectedGenre, setSelectedGenre, genres, filteredBooks, openReader, readerDashboardBg, isSidebarOpen, setIsSidebarOpen }) {
  const [donatingBook, setDonatingBook] = useState(null)
  const [payingBook, setPayingBook] = useState(null)
  const [readerEmail, setReaderEmail] = useState('')
  const [purchases, setPurchases] = useState([])
  const [purchasePaying, setPurchasePaying] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => { loadPaystack().catch(() => {}) }, [])
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data?.user?.email) setReaderEmail(data.user.email) }) }, [])
  useEffect(() => {
    if (!user?.id) return
    supabase.from('book_purchases').select('book_id').eq('reader_id', user.id).then(({ data }) => { if (data) setPurchases(data.map(p => p.book_id)) })
  }, [user])

  const hasPurchased = (bookId) => purchases.includes(bookId)
  const handleReadNow = (book) => { if (book.is_paid && !hasPurchased(book.id)) { setPayingBook(book) } else { openReader(book) } }

  const handlePurchase = async () => {
    setPurchaseError('')
    if (!payingBook) return
    setPurchasePaying(true)
    try {
      const PaystackPop = await loadPaystack()
      const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, email: readerEmail || 'reader@safereadke.com',
        amount: payingBook.price * 100, currency: 'KES', ref: 'PURCHASE_' + Date.now(),
        callback: (response) => {
          supabase.from('book_purchases').insert({ book_id: payingBook.id, reader_id: user.id, amount_paid: payingBook.price, payment_ref: response.reference })
            .then(() => { setPurchases(prev => [...prev, payingBook.id]); setPurchasePaying(false); const book = payingBook; setPayingBook(null); openReader(book) })
        },
        onClose: () => setPurchasePaying(false),
      })
      handler.openIframe()
    } catch (err) { setPurchasePaying(false); setPurchaseError('Could not connect to Paystack: ' + err.message) }
  }

  // ── Amber/gold literary theme ──────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0d0a04', fontFamily: "'Georgia', serif", position: 'relative' }}>
      {/* Atmospheric background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${readerDashboardBg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(212,175,55,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(180,120,20,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
      <style>{`
        .reader-sidebar-toggle { display: none; }
        .reader-sidebar { display: flex; }
        @media (max-width: 640px) {
          .reader-sidebar-toggle { display: flex !important; }
          .reader-sidebar {
            position: fixed !important;
            left: 0; top: 0;
            height: 100vh;
            z-index: 40;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            width: 220px !important;
          }
          .reader-sidebar.open { transform: translateX(0) !important; }
          .reader-main { padding: 3.5rem 0.875rem 1rem !important; }
          .reader-overlay { display: block !important; }
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
            className="reader-sidebar-toggle"
            onClick={() => setIsSidebarOpen(true)}
            style={{
              alignItems: 'center', justifyContent: 'center',
              position: 'fixed', top: '4rem', left: '0.75rem', zIndex: 50,
              background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.35)',
              borderRadius: '10px', padding: '0.55rem 0.7rem', color: '#d4af37',
              cursor: 'pointer', fontSize: '1.1rem', backdropFilter: 'blur(10px)',
              lineHeight: 1
            }}>
            ☰
          </button>
        )}

        {/* Sidebar */}
        <nav
          className={`reader-sidebar${isSidebarOpen ? ' open' : ''}`}
          style={{
          width: '220px', minHeight: '100vh', background: 'rgba(26,18,8,0.98)', borderRight: '1px solid rgba(212,175,55,0.15)',
          padding: '2rem 1.25rem', flexDirection: 'column', gap: '0.5rem', backdropFilter: 'blur(20px)', flexShrink: 0
        }}>

          {/* Close button — inside sidebar at the top */}
          <div className="reader-sidebar-toggle" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button onClick={() => setIsSidebarOpen(false)} style={{
              background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: '8px', padding: '0.4rem 0.65rem', color: '#d4af37',
              cursor: 'pointer', fontSize: '1rem', lineHeight: 1
            }}>✕</button>
          </div>

          <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(212,175,55,0.15)' }}>
            <p style={{ color: '#d4af37', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>SafeRead KE</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>Reader</p>
          </div>
          {[{ key: 'home', label: 'Home', icon: '⌂' }, { key: 'genres', label: 'Browse', icon: '◈' }].map(({ key, label, icon }) => (
            <button key={key} onClick={() => { setReaderTab(key); setIsSidebarOpen(false) }} style={{
              padding: '0.75rem 1rem', borderRadius: '10px', border: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', fontFamily: 'Georgia, serif', fontWeight: 600, transition: 'all 0.2s',
              background: readerTab === key ? 'rgba(212,175,55,0.15)' : 'transparent',
              color: readerTab === key ? '#d4af37' : 'rgba(255,255,255,0.5)',
              borderLeft: readerTab === key ? '2px solid #d4af37' : '2px solid transparent'
            }}>
              <span style={{ fontSize: '1rem' }}>{icon}</span> {label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main className="reader-main" style={{ flex: 1, padding: '2.5rem', color: 'white', overflowY: 'auto', minWidth: 0 }}>
          {readerTab === 'home' && (
            <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'Georgia, serif', color: '#d4af37', marginBottom: '1rem', letterSpacing: '-0.5px' }}>Welcome, Reader</h2>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
                Discover Kenyan stories. Browse genres, find your next read, and support the authors who bring them to life.
              </p>
              <button onClick={() => setReaderTab('genres')} style={{ padding: '0.875rem 2.5rem', borderRadius: '50px', border: '1px solid rgba(212,175,55,0.4)', background: 'rgba(212,175,55,0.1)', color: '#d4af37', fontFamily: 'Georgia, serif', fontSize: '0.95rem', cursor: 'pointer', letterSpacing: '0.05em' }}>
                Browse Books →
              </button>
            </div>
          )}

          {readerTab === 'genres' && (
            <div>
              {/* Genre pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                {genres.map(g => (
                  <button key={g} onClick={() => setSelectedGenre(g)} style={{
                    padding: '0.4rem 1rem', borderRadius: '50px', border: selectedGenre === g ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.15)',
                    background: selectedGenre === g ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                    color: selectedGenre === g ? '#d4af37' : 'rgba(255,255,255,0.5)', fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600, transition: 'all 0.2s'
                  }}>{g}</button>
                ))}
              </div>

              <h2 style={{ fontSize: '1.75rem', fontFamily: 'Georgia, serif', color: '#d4af37', marginBottom: '1.5rem', fontStyle: 'italic' }}>{selectedGenre}</h2>

              {filteredBooks.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '4rem', fontSize: '0.95rem' }}>No books in {selectedGenre} yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.5rem' }}>
                  {filteredBooks.map(book => {
                    const coverUrl = book.cover_path ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl : 'https://placehold.co/300x450?text=No+Cover'
                    const isPaid = book.is_paid && !hasPurchased(book.id)
                    return (
                      <div key={book.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '16px', overflow: 'hidden', transition: 'all 0.3s', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(212,175,55,0.3)'; e.currentTarget.style.background = 'rgba(212,175,55,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(212,175,55,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
                        <div style={{ position: 'relative' }}>
                          <img src={coverUrl} alt={book.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                          {book.is_paid && (
                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: hasPurchased(book.id) ? 'rgba(34,197,94,0.9)' : 'rgba(212,175,55,0.9)', color: '#1a1208', fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', fontFamily: 'sans-serif' }}>
                              {hasPurchased(book.id) ? '✓ OWNED' : `KES ${book.price}`}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '0.875rem' }}>
                          <h3 style={{ fontSize: '1rem', fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.9)', marginBottom: '0.25rem', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.75rem', fontFamily: 'sans-serif' }}>by {book.author_name || 'Unknown'}</p>
                          <button onClick={() => handleReadNow(book)} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: 'none', background: isPaid ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.9)', color: isPaid ? '#d4af37' : '#1a1208', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', marginBottom: '0.4rem', fontFamily: 'sans-serif', border: isPaid ? '1px solid rgba(212,175,55,0.4)' : 'none' }}>
                            {isPaid ? `Buy · KES ${book.price}` : 'Read Now'}
                          </button>
                          <button onClick={() => setDonatingBook(book)} style={{ width: '100%', padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)', background: 'transparent', color: 'rgba(212,175,55,0.6)', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                            ♥ Support Author
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Purchase modal */}
      {payingBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1a1208', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '20px', padding: '2rem', maxWidth: '360px', width: '100%', color: 'white' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Purchase Book</h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>{payingBook.title} · by {payingBook.author_name}</p>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(212,175,55,0.08)', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.15)' }}>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>One-time · Unlimited access</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#d4af37' }}>KES {payingBook.price}</p>
            </div>
            {purchaseError && <p style={{ color: '#f87171', fontSize: '0.95rem', marginBottom: '0.75rem' }}>⚠️ {purchaseError}</p>}
            <button onClick={handlePurchase} disabled={purchasePaying} style={{ width: '100%', padding: '0.875rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #d4af37, #b8860b)', color: '#1a1208', fontWeight: 700, cursor: purchasePaying ? 'not-allowed' : 'pointer', marginBottom: '0.75rem' }}>
              {purchasePaying ? 'Opening Paystack…' : `Pay KES ${payingBook.price} & Read`}
            </button>
            <button onClick={() => setPayingBook(null)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {donatingBook && <DonateModal book={donatingBook} readerEmail={readerEmail} onClose={() => setDonatingBook(null)} />}
    </div>
  )
}