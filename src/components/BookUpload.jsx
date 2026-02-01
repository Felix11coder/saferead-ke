import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function BookUpload({ user }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('Fiction')
  const [pdfFile, setPdfFile] = useState(null)  // Renamed to pdfFile for clarity
  const [coverFile, setCoverFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!pdfFile || !title || !genre) {
      return alert('Title, genre, and PDF file are required')
    }

    setUploading(true)

    try {
      // 1. Upload PDF
      const pdfExt = pdfFile.name.split('.').pop()
      const pdfName = `${user.id}/${Date.now()}.${pdfExt}`
      console.log('Uploading PDF to:', pdfName)

      const { error: pdfUploadError } = await supabase.storage
        .from('books')
        .upload(pdfName, pdfFile)

      if (pdfUploadError) throw pdfUploadError

      console.log('PDF upload success!')

      let coverName = null

      // 2. Upload cover if selected
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop().toLowerCase()
        if (!['jpg', 'jpeg', 'png'].includes(coverExt)) {
          throw new Error('Cover must be JPG or PNG')
        }
        coverName = `${user.id}/${Date.now()}_cover.${coverExt}`
        console.log('Uploading cover to:', coverName)

        const { error: coverUploadError } = await supabase.storage
          .from('books')
          .upload(coverName, coverFile)

        if (coverUploadError) throw coverUploadError

        console.log('Cover upload success!')
      }

      // 3. Insert metadata into DB
      const { error: dbError } = await supabase
        .from('books')
        .insert({
          title,
          genre,
          author_id: user.id,
          file_path: pdfName,      // PDF path
          cover_path: coverName,   // Cover path (null if none)
          status: 'pending'
        })

      if (dbError) throw dbError

      alert('Book uploaded successfully! Waiting for approval.')
    } catch (err) {
      console.error('Upload error:', err)
      alert('Upload failed: ' + (err.message || 'Unknown error'))
    } finally {
      setUploading(false)
      setTitle('')
      setGenre('Fiction')
      setPdfFile(null)
      setCoverFile(null)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Upload New Book</h2>

      <input
        type="text"
        placeholder="Book Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full p-3 mb-4 border rounded"
      />

      <select
        value={genre}
        onChange={(e) => setGenre(e.target.value)}
        className="w-full p-3 mb-4 border rounded"
      >
        <option>Fiction</option>
        <option>Non-Fiction</option>
        <option>Mystery</option>
        <option>Romance</option>
        <option>Sci-Fi</option>
        <option>Fantasy</option>
        <option>Horror</option>
        <option>Thriller</option>
        <option>Historical Fiction</option>
        <option>Biography</option>
        <option>Self-Help</option>
        <option>Poetry</option>
        <option>Young Adult</option>
        <option>Business</option>
        <option>Science</option>
        <option>Travel</option>
        <option>Cooking</option>
        <option>Art</option>
        <option>Religion</option>
        <option>Health</option>
        <option>Other</option>
      </select>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">PDF File (required)</label>
        <input
          type="file"
          accept=".pdf,.epub"
          onChange={(e) => setPdfFile(e.target.files[0])}
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Cover Image (jpg/png, optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setCoverFile(e.target.files[0])}
          className="w-full"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {uploading ? 'Uploading...' : 'Upload Book'}
      </button>
    </div>
  )
}