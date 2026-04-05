// src/components/BookUpload.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const GENRES = [
  'Sci-Fi', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Thriller', 'Historical',
  'Biography', 'Self-Help', 'Poetry', 'Young Adult', 'Business', 'Science',
  'Travel', 'Cooking', 'Art', 'Religion', 'Health', 'Other'
]

export default function BookUpload({ user }) {
  const [title, setTitle]         = useState('')
  const [genre, setGenre]         = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [bookFile, setBookFile]   = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState('')
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState('')

  // Fetched automatically from users table — not typed manually
  const [authorName, setAuthorName] = useState('')
  const [nameLoading, setNameLoading] = useState(true)

  // ── Auto-fetch author name from users table ──────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('author_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setAuthorName(data?.author_name || '')
        setNameLoading(false)
      })
  }, [user])

  const handleCoverChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleBookChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setBookFile(file)
  }

  const reset = () => {
    setTitle('')
    setGenre('')
    setCoverFile(null)
    setBookFile(null)
    setCoverPreview(null)
    setProgress('')
    setSuccess(false)
    setError('')
  }

  const handleUpload = async () => {
    setError('')
    setSuccess(false)

    if (!title.trim())  return setError('Please enter a book title.')
    if (!genre)         return setError('Please select a genre.')
    if (!bookFile)      return setError('Please select a PDF file to upload.')
    if (bookFile.type !== 'application/pdf')
                        return setError('Only PDF files are accepted.')
    if (!coverFile)     return setError('Please select a cover image.')
    if (!coverFile.type.startsWith('image/'))
                        return setError('Cover must be an image file (JPG, PNG, etc).')

    setUploading(true)

    try {
      const uid       = user.id
      const timestamp = Date.now()
      const safeTitle = title.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')

      // 1. Upload cover
      setProgress('Uploading cover image…')
      const coverExt  = coverFile.name.split('.').pop()
      const coverPath = `covers/${uid}/${safeTitle}_${timestamp}.${coverExt}`
      const { error: coverErr } = await supabase.storage
        .from('books').upload(coverPath, coverFile, { upsert: false })
      if (coverErr) throw new Error('Cover upload failed: ' + coverErr.message)

      // 2. Upload PDF
      setProgress('Uploading book PDF…')
      const filePath = `pdfs/${uid}/${safeTitle}_${timestamp}.pdf`
      const { error: fileErr } = await supabase.storage
        .from('books').upload(filePath, bookFile, { upsert: false })
      if (fileErr) throw new Error('PDF upload failed: ' + fileErr.message)

      // 3. Insert book record with author_name from users table
      setProgress('Saving book details…')
      const { error: dbErr } = await supabase.from('books').insert({
        title:       title.trim(),
        author_name: authorName || null,
        genre,
        author_id:   uid,
        file_path:   filePath,
        cover_path:  coverPath,
        status:      'pending',
      })
      if (dbErr) throw new Error('Database error: ' + dbErr.message)

      setProgress('')
      setSuccess(true)

    } catch (err) {
      console.error(err)
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // ── Success screen ───────────────────────────────────────────────────
  if (success) {
    return (
      <div className="text-center py-16 px-4">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-2xl font-bold text-white mb-3">Book Submitted!</h3>
        <p className="text-gray-300 mb-8 max-w-md mx-auto">
          Your book has been submitted for review. It will appear in the library once an admin approves it.
        </p>
        <button onClick={reset} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-medium transition">
          Upload Another Book
        </button>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">

      {/* Author name — read-only, auto-fetched */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
          Author Name
        </label>
        {nameLoading ? (
          <div className="w-full px-4 py-3 rounded-xl bg-white/20 text-white/50 text-sm">
            Loading your author name…
          </div>
        ) : authorName ? (
          <div className="w-full px-4 py-3 rounded-xl bg-white/20 text-white font-medium flex items-center gap-2">
            <span className="text-green-400">✓</span> {authorName}
          </div>
        ) : (
          <div className="w-full px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 text-sm">
            ⚠️ No author name found on your account. Please contact support or update your profile.
          </div>
        )}
      </div>

      {/* Book Title */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
          Book Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter your book title"
          disabled={uploading}
          className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
        />
      </div>

      {/* Genre */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
          Genre *
        </label>
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          disabled={uploading}
          className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
        >
          <option value="">— Select a genre —</option>
          {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Cover Image */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
          Cover Image * (JPG, PNG)
        </label>
        <div className="flex items-start gap-4">
          <label className="flex-1 cursor-pointer">
            <div className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
              coverFile ? 'border-purple-400 bg-purple-500/10' : 'border-white/30 hover:border-purple-400 hover:bg-white/5'
            }`}>
              <p className="text-white/70 text-sm">
                {coverFile ? coverFile.name : 'Click to choose cover image'}
              </p>
            </div>
            <input type="file" accept="image/*" onChange={handleCoverChange} disabled={uploading} className="hidden" />
          </label>
          {coverPreview && (
            <img src={coverPreview} alt="Cover preview" className="w-20 h-28 object-cover rounded-lg border border-white/20 shrink-0" />
          )}
        </div>
      </div>

      {/* PDF File */}
      <div className="mb-7">
        <label className="block text-sm font-semibold text-white/80 mb-2 uppercase tracking-wider">
          Book PDF *
        </label>
        <label className="cursor-pointer block">
          <div className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
            bookFile ? 'border-purple-400 bg-purple-500/10' : 'border-white/30 hover:border-purple-400 hover:bg-white/5'
          }`}>
            <p className="text-white/70 text-sm">
              {bookFile ? `${bookFile.name} (${(bookFile.size / 1024 / 1024).toFixed(2)} MB)` : 'Click to choose PDF file'}
            </p>
          </div>
          <input type="file" accept="application/pdf" onChange={handleBookChange} disabled={uploading} className="hidden" />
        </label>
      </div>

      {error && (
        <div className="mb-5 bg-red-500/20 border border-red-400/40 text-red-200 text-sm rounded-xl px-4 py-3">
          ⚠️ {error}
        </div>
      )}

      {progress && (
        <div className="mb-5 bg-purple-500/20 border border-purple-400/40 text-purple-200 text-sm rounded-xl px-4 py-3 animate-pulse">
          ⏳ {progress}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading || !authorName}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-base transition"
      >
        {uploading ? 'Uploading…' : 'Submit Book for Review'}
      </button>

      <p className="text-center text-xs text-white/40 mt-4">
        Your book will be reviewed by an admin before going live.
      </p>
    </div>
  )
}