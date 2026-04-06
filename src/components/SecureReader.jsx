import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import * as pdfjsLib from 'pdfjs-dist/webpack'

// ─── logPageView ─────────────────────────────────────────────────────────────
async function logPageView(book, userId) {
  if (!book?.id || !book?.author_id) return
  try {
    await supabase.from('page_views').insert({
      book_id:   book.id,
      author_id: book.author_id,
      viewed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('page_view log failed:', err.message)
  }
}

export default function SecureReader({ book, bookPath }) {
  const resolvedPath = book?.file_path ?? bookPath

  const [pdfDoc, setPdfDoc]     = useState(null)
  const [pageNum, setPageNum]   = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const canvasRef               = useRef(null)
  const containerRef            = useRef(null)

  const [userEmail, setUserEmail] = useState('Reader')
  const [userId, setUserId]       = useState(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? 'Reader')
        setUserId(data.user.id ?? null)
      }
    })
  }, [])

  // Anti-piracy
  useEffect(() => {
    const preventContext = (e) => e.preventDefault()
    const preventPrint = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        alert('Printing is disabled for security')
      }
    }
    document.addEventListener('contextmenu', preventContext)
    document.addEventListener('keydown', preventPrint)
    return () => {
      document.removeEventListener('contextmenu', preventContext)
      document.removeEventListener('keydown', preventPrint)
    }
  }, [])

  // Load PDF
  useEffect(() => {
    if (!resolvedPath) {
      setError('No book path provided')
      setLoading(false)
      return
    }

    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)

        const { data, error: signError } = await supabase.storage
          .from('books')
          .createSignedUrl(resolvedPath, 3600)

        if (signError) throw signError
        if (!data?.signedUrl) throw new Error('No signed URL returned')

        const pdf = await pdfjsLib.getDocument(data.signedUrl).promise

        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoading(false)

        renderPage(1, pdf)
        logPageView(book, userId)

      } catch (err) {
        setError('Failed to load book: ' + (err.message || 'Unknown error'))
        setLoading(false)
      }
    }

    loadPdf()
    return () => { if (pdfDoc) pdfDoc.destroy() }
  }, [resolvedPath])

  // Re-render current page when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (pdfDoc) renderPage(pageNum, pdfDoc)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDoc, pageNum])

  const renderPage = async (num, pdf = pdfDoc) => {
    if (!pdf) return
    try {
      const page = await pdf.getPage(num)

      // Use full window width — accounts for any outer padding/modal wrappers
      const availableWidth = window.innerWidth
      const unscaledVp     = page.getViewport({ scale: 1 })
      const scale          = availableWidth / unscaledVp.width
      const viewport       = page.getViewport({ scale })

      const canvas = canvasRef.current
      if (!canvas) return

      // Use devicePixelRatio for sharp rendering on retina/mobile screens
      const dpr        = window.devicePixelRatio || 1
      canvas.width     = viewport.width  * dpr
      canvas.height    = viewport.height * dpr
      canvas.style.width  = viewport.width  + 'px'
      canvas.style.height = viewport.height + 'px'

      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      await page.render({ canvasContext: ctx, viewport }).promise

      // Watermark — scale font to canvas size
      const fontSize = Math.max(12, Math.round(viewport.width * 0.035))
      ctx.save()
      ctx.globalAlpha  = 0.3
      ctx.font         = `italic bold ${fontSize}px Arial`
      ctx.fillStyle    = '#555555'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`SafeRead KE • ${userEmail}`, viewport.width - 16, viewport.height - 12)
      ctx.restore()

    } catch (err) {
      console.error('Render error:', err)
    }
  }

  const goToPage = (num) => {
    if (num < 1 || num > numPages) return
    setPageNum(num)
    renderPage(num)
    logPageView(book, userId)
    // Scroll canvas back to top on page turn
    canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: '1rem' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(0,0,0,0.1)', borderTop: '3px solid #555', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: '#666', fontSize: '0.95rem' }}>Loading secure reader…</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontWeight: 600 }}>{error}</p>
    </div>
  )

  // ── Main reader UI ────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#e5e7eb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0.625rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.5rem', flexShrink: 0
      }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', margin: 0, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book?.title ?? 'Secure Reader'}
        </p>
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0, whiteSpace: 'nowrap' }}>
          Page {pageNum} / {numPages}
        </p>
      </div>

      {/* Canvas — fills all available vertical space */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>

      {/* Navigation bar — pinned to bottom */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 10,
        background: 'white', borderTop: '1px solid #e5e7eb',
        padding: '0.625rem 0.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        flexShrink: 0
      }}>
        <button onClick={() => goToPage(1)} disabled={pageNum <= 1}
          style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', background: pageNum <= 1 ? '#f9fafb' : 'white', color: pageNum <= 1 ? '#9ca3af' : '#374151', fontSize: '0.8rem', cursor: pageNum <= 1 ? 'not-allowed' : 'pointer' }}>
          ««
        </button>
        <button onClick={() => goToPage(pageNum - 1)} disabled={pageNum <= 1}
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', background: pageNum <= 1 ? '#f9fafb' : 'white', color: pageNum <= 1 ? '#9ca3af' : '#374151', fontSize: '0.875rem', cursor: pageNum <= 1 ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
          ‹ Prev
        </button>
        <span style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {pageNum} / {numPages}
        </span>
        <button onClick={() => goToPage(pageNum + 1)} disabled={pageNum >= numPages}
          style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', background: pageNum >= numPages ? '#f9fafb' : 'white', color: pageNum >= numPages ? '#9ca3af' : '#374151', fontSize: '0.875rem', cursor: pageNum >= numPages ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
          Next ›
        </button>
        <button onClick={() => goToPage(numPages)} disabled={pageNum >= numPages}
          style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', border: '1px solid #d1d5db', background: pageNum >= numPages ? '#f9fafb' : 'white', color: pageNum >= numPages ? '#9ca3af' : '#374151', fontSize: '0.8rem', cursor: pageNum >= numPages ? 'not-allowed' : 'pointer' }}>
          »»
        </button>
      </div>

    </div>
  )
}