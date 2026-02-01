import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import * as pdfjsLib from 'pdfjs-dist/webpack'

export default function SecureReader({ bookPath }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)

  const [userEmail, setUserEmail] = useState('Reader')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email)
    })
  }, [])

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

  useEffect(() => {
    if (!bookPath) {
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
          .createSignedUrl(bookPath, 3600)

        if (signError) throw signError
        if (!data?.signedUrl) throw new Error('No signed URL returned')

        const loadingTask = pdfjsLib.getDocument(data.signedUrl)
        const pdf = await loadingTask.promise

        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setLoading(false)

        renderPage(1, pdf)
      } catch (err) {
        setError('Failed to load book: ' + (err.message || 'Unknown error'))
        setLoading(false)
      }
    }

    loadPdf()

    return () => {
      if (pdfDoc) pdfDoc.destroy()
    }
  }, [bookPath])

  const renderPage = async (num, pdf = pdfDoc) => {
    if (!pdf) return
    try {
      const page = await pdf.getPage(num)
      const viewport = page.getViewport({ scale: 1.5 })

      const canvas = canvasRef.current
      if (!canvas) return

      canvas.height = viewport.height
      canvas.width = viewport.width

      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      }

      await page.render(renderContext).promise

      // Watermark - Option 3: Corner Placement
      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.globalAlpha = 0.35
      ctx.font = 'italic bold 28px Arial'
      ctx.fillStyle = '#555555'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'

      ctx.fillText(`SafeRead KE • ${userEmail}`, canvas.width - 30, canvas.height - 20)

      ctx.restore()
    } catch (err) {
      console.error('Render error:', err)
    }
  }

  const goToPage = (num) => {
    if (num < 1 || num > numPages) return
    setPageNum(num)
    renderPage(num)
  }

  if (loading) return <p className="text-center text-gray-600">Loading secure reader...</p>
  if (error) return <p className="text-center text-red-600 font-bold">{error}</p>

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-4">Secure Reader – Page {pageNum} of {numPages}</h2>
      <div className="mb-4 flex justify-center gap-4">
        <button
          onClick={() => goToPage(pageNum - 1)}
          disabled={pageNum <= 1}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Previous
        </button>
        <button
          onClick={() => goToPage(pageNum + 1)}
          disabled={pageNum >= numPages}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          Next
        </button>
      </div>
      <div className="border border-gray-300 shadow-lg">
        <canvas ref={canvasRef} className="mx-auto" />
      </div>
      <p className="text-center mt-4 text-sm text-gray-600">
        Content protected – no download/print/screenshot allowed
      </p>
    </div>
  )
}