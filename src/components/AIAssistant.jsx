// src/components/AIAssistant.jsx
import { useState, useRef, useEffect } from 'react'

// ── Smart offline responses (no API key needed) ───────────────────────────────
const RESPONSES = {
  // Reader
  'find books':     'Head to the **Browse** tab in the sidebar and filter by genre. You can also use the search bar at the top to search by title or author! 📚',
  'browse':         'Tap ☰ to open the sidebar, then select **Browse** to explore books by genre. Use the search bar to find specific titles.',
  'buy':            "When you open a paid book, you'll see a **Buy** button. Tap it and you'll be prompted to pay via M-Pesa or card through Paystack. Once confirmed, the book unlocks instantly! 💳",
  'mpesa':          'SafeRead KE uses **Paystack** to process M-Pesa payments. When buying a book or donating, select M-Pesa, enter your number, and confirm the STK push on your phone. 📱',
  'donate':         'Open any book and scroll to the author section — you\'ll find a **Donate** button there. 100% of your donation goes directly to the author! ❤️',
  'read':           'Tap any book cover to open it. Books are displayed securely on a canvas — they cannot be downloaded, copied, or printed, keeping authors protected. 🔒',
  'download':       'Downloading is intentionally disabled on SafeRead KE to protect authors from piracy. You can read books anytime online through the platform. 🛡️',

  // Author
  'upload':         'Go to the **Upload** tab in your sidebar. Fill in the title, description, genre, cover image (JPG/PNG), and your PDF. Hit **Submit for Review** — an admin will approve it shortly! 📤',
  'earnings':       'Check your **Stats** tab to see real-time page views, donations, book sales (you get 70%), and ad revenue (you get 65%). All tracked automatically! 📊',
  'payout':         "Once your earnings are ready, the admin sends them directly to your M-Pesa number via Paystack. Make sure your M-Pesa number is saved in your Upload form. 💰",
  'paid':           'Payouts are sent by the admin to your registered M-Pesa number. Authors keep 70% of book sales, 100% of donations, and 65% of ad revenue. 🎉',
  'stats':          'Your **Stats** tab shows per-book page views, total reads, donation history, and estimated earnings — all updated in real time as readers engage with your books.',
  'revenue':        'You earn from three streams: **donations** (100% yours), **book sales** (70% share), and **ad revenue** (65% share). The admin disburses earnings via M-Pesa. 💵',
  'pending':        'After uploading, your book goes into **Pending** status. An admin reviews and either approves or rejects it. You\'ll see the status update in your Library tab.',

  // Admin
  'approve':        'Go to the **Pending** tab, preview the book using the secure reader, then click **Approve** ✅ or **Reject** ❌. Approved books go live in the catalogue immediately.',
  'reject':         "In the **Pending** tab, click **Reject** on any book that doesn't meet standards. The author will see the status change in their Library.",
  'catalogue':      'The **Catalogue** tab shows all approved books. You can toggle books between free and paid, set prices, and manage the full library from there.',
  'members':        'The **Members** tab lists all registered users. You can view their roles (Reader/Author/Admin) and manage accounts from there.',
  'analytics':      'The **Analytics** tab shows book view counts ranked by popularity, plus a log of recent donations across the platform. Great for spotting trending titles! 📈',
  'send payout':    'Go to **Payouts** tab — each author card shows their pending earnings. Click **Send via M-Pesa** to initiate a direct Paystack transfer to their phone. ✅',
  'payouts':        "The **Payouts** tab shows every author's pending earnings broken down by donations, book sales, and ad revenue. Click the green button to send via M-Pesa.",

  // General
  'piracy':         'SafeRead KE renders books on a **canvas element** — not a PDF viewer. This means readers cannot right-click, save, copy text, or print. It\'s our core anti-piracy protection. 🛡️',
  'safe':           'Books on SafeRead KE are rendered on a secure canvas with a watermark showing the reader\'s email. Downloading, copying, and printing are all disabled.',
  'watermark':      'Every page you read is watermarked with your email address and "SafeRead KE" — this helps track and deter any screenshot-based piracy.',
  'paystack':       'SafeRead KE uses **Paystack** for all payments — M-Pesa, debit/credit cards, and bank transfers are all supported. It\'s secure and widely used in Kenya.',
  'hello':          "Hi there! 👋 I'm the SafeRead KE assistant. Ask me about reading books, uploading as an author, managing payouts as admin, or anything else about the platform!",
  'hi':             'Hey! 👋 How can I help you with SafeRead KE today?',
  'help':           'I can help you with: finding and reading books 📚, uploading books as an author 📤, tracking earnings 💰, sending payouts as admin 📱, or understanding how the platform works. What do you need?',
  'genre':          'SafeRead KE has books across many genres: Sci-Fi, Romance, Mystery, Fantasy, Horror, Thriller, Biography, Self-Help, Poetry, Young Adult, Business, and more! Use **Browse** to filter by genre.',
  'free':           'Some books on SafeRead KE are free to read — just tap and start reading! Paid books require purchase via M-Pesa or card. The admin sets whether a book is free or paid.',
  'price':          'Admins set book prices in the **Catalogue** tab. Authors don\'t set their own prices — the admin manages this to keep pricing consistent across the platform.',
  'account':        "To get started, sign up with your email. You'll be assigned the **Reader** role by default. Authors are upgraded by the admin after submitting their first book.",
  'role':           'There are three roles on SafeRead KE: **Reader** (browse & read), **Author** (upload & earn), and **Admin** (manage everything). Roles are assigned and managed by the admin.',
  'default':        'Great question! SafeRead KE is built to help Kenyan authors share their work securely while earning fairly. Could you be more specific? I can help with reading, uploading, earnings, payouts, or platform navigation. 😊'
}

function getResponse(userInput) {
  const input = userInput.toLowerCase()
  for (const [keyword, response] of Object.entries(RESPONSES)) {
    if (keyword !== 'default' && input.includes(keyword)) return response
  }
  return RESPONSES['default']
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function AIAssistant({ userRole }) {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi! 👋 I'm the SafeRead KE assistant. Ask me anything about how to use the platform${userRole ? ` as a ${userRole}` : ''}.` }
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = async (overrideText) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    await sleep(700 + Math.random() * 500)
    setMessages(prev => [...prev, { role: 'assistant', content: getResponse(text) }])
    setLoading(false)
  }

  const accentColor = userRole === 'admin' ? 'rgba(255,255,255,0.8)' : userRole === 'author' ? '#22c55e' : '#d4af37'
  const bgColor     = userRole === 'admin' ? '#0a0b0d' : userRole === 'author' ? '#060d08' : '#0d0a04'
  const borderColor = userRole === 'admin' ? 'rgba(255,255,255,0.1)' : userRole === 'author' ? 'rgba(34,197,94,0.2)' : 'rgba(212,175,55,0.2)'
  const gradientBg  = accentColor === '#d4af37' ? '#d4af37, #b8860b' : accentColor === '#22c55e' ? '#22c55e, #16a34a' : '#667eea, #764ba2'

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: '1.5rem', right: '1.25rem', zIndex: 200,
            width: '52px', height: '52px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${gradientBg})`,
            border: 'none', cursor: 'pointer', fontSize: '1.4rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s'
          }}
          title="Ask SafeRead AI"
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >🤖</button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 200,
          width: 'min(360px, calc(100vw - 2rem))',
          height: 'min(520px, calc(100vh - 6rem))',
          background: bgColor, border: `1px solid ${borderColor}`,
          borderRadius: '20px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)', overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', margin: 0, fontFamily: 'Georgia, serif' }}>SafeRead Assistant</p>
                <p style={{ color: accentColor, fontSize: '0.7rem', margin: 0, fontFamily: 'sans-serif', opacity: 0.8 }}>Ask me anything about the platform</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: '0.2rem' }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '0.6rem 0.875rem',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? `rgba(${accentColor === '#d4af37' ? '212,175,55' : accentColor === '#22c55e' ? '34,197,94' : '102,126,234'},0.2)` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${msg.role === 'user' ? borderColor : 'rgba(255,255,255,0.06)'}`,
                  color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', lineHeight: 1.55, fontFamily: 'sans-serif'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.6rem 0.875rem', borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ color: accentColor, fontSize: '1rem', letterSpacing: '0.15em' }}>● ● ●</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {messages.length === 1 && (
            <div style={{ padding: '0 0.875rem 0.625rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', flexShrink: 0 }}>
              {(userRole === 'reader'
                ? ['How do I find books?', 'How do I buy a paid book?', 'How do I donate to an author?']
                : userRole === 'author'
                ? ['How do I upload a book?', 'How do I track my earnings?', 'When do I get paid?']
                : ['How do I approve a book?', 'How do I send a payout?', 'What does Analytics show?']
              ).map(q => (
                <button key={q} onClick={() => send(q)}
                  style={{ padding: '0.35rem 0.75rem', borderRadius: '50px', border: `1px solid ${borderColor}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                >{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: `1px solid ${borderColor}`, display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a question…"
              disabled={loading}
              style={{ flex: 1, padding: '0.55rem 0.875rem', borderRadius: '12px', border: `1px solid ${borderColor}`, background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: '0.875rem', outline: 'none', fontFamily: 'sans-serif' }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                padding: '0.55rem 1rem', borderRadius: '12px', border: 'none',
                background: loading || !input.trim() ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${gradientBg})`,
                color: loading || !input.trim() ? 'rgba(255,255,255,0.3)' : (accentColor === '#d4af37' ? '#1a1208' : 'white'),
                fontWeight: 700, fontSize: '0.85rem',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif'
              }}>↑</button>
          </div>
        </div>
      )}
    </>
  )
}