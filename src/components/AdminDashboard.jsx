import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import SecureReader from './SecureReader'

export default function AdminDashboard() {
  const [pendingBooks, setPendingBooks] = useState([])
  const [approvedBooks, setApprovedBooks] = useState([])
  const [users, setUsers] = useState([]) // New: users list
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const [adminTab, setAdminTab] = useState('pending')
  const [selectedGenre, setSelectedGenre] = useState('Sci-Fi')
  const [selectedBookForReading, setSelectedBookForReading] = useState(null)

  const genres = [
    'Sci-Fi', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Thriller', 'Historical',
    'Biography', 'Self-Help', 'Poetry', 'Young Adult', 'Business', 'Science',
    'Travel', 'Cooking', 'Art', 'Religion', 'Health', 'Other'
  ]

  const fetchPendingBooks = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      console.log('Pending books fetched:', data)
      setPendingBooks(data || [])
    } catch (err) {
      console.error('Fetch pending books error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedBooks = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (error) throw error
      console.log('Approved books fetched:', data)
      setApprovedBooks(data || [])
    } catch (err) {
      console.error('Fetch approved books error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // New: Fetch all users (admin only)
  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      console.log('Users fetched:', data)
      setUsers(data || [])
    } catch (err) {
      console.error('Fetch users error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminTab === 'pending') {
      fetchPendingBooks()
    } else if (adminTab === 'genres') {
      fetchApprovedBooks()
    } else if (adminTab === 'users') {
      fetchUsers()
    }
  }, [adminTab])

  const approveBook = async (bookId) => {
    console.log('Approve button clicked for book ID:', bookId)
    setApprovingId(bookId)
    try {
      const { data: updateData, error: updateError } = await supabase
        .from('books')
        .update({ status: 'approved' })
        .eq('id', bookId)
        .select()
      console.log('Update result:', { updateData, updateError })
      if (updateError) throw updateError
      alert('Book approved successfully!')
      await Promise.all([
        fetchPendingBooks(),
        fetchApprovedBooks()
      ])
      console.log('Refresh complete')
    } catch (err) {
      alert('Approval failed: ' + err.message)
      console.error('Full approve error:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const openReader = (book) => {
    setSelectedBookForReading(book)
  }

  const closeReader = () => {
    setSelectedBookForReading(null)
  }

  const filteredApprovedBooks = approvedBooks.filter(book => book.genre === selectedGenre)

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      {/* Top-level admin tabs */}
      <div className="flex gap-6 mb-8 border-b pb-4 flex-wrap">
        <button
          onClick={() => setAdminTab('home')}
          className={`px-6 py-3 rounded font-medium transition ${
            adminTab === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
          }`}
        >
          Home
        </button>
        <button
          onClick={() => setAdminTab('pending')}
          className={`px-6 py-3 rounded font-medium transition ${
            adminTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
          }`}
        >
          Pending List
        </button>
        <button
          onClick={() => setAdminTab('genres')}
          className={`px-6 py-3 rounded font-medium transition ${
            adminTab === 'genres' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
          }`}
        >
          Genres
        </button>
        {/* New Users tab */}
        <button
          onClick={() => setAdminTab('users')}
          className={`px-6 py-3 rounded font-medium transition ${
            adminTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
          }`}
        >
          Users
        </button>
      </div>

      {/* Home */}
      {adminTab === 'home' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Admin Home</h2>
          <p className="text-gray-600">
            Welcome to the admin dashboard. Use "Pending List" to review and approve new books,
            "Genres" to browse approved books, or "Users" to view all registered users.
          </p>
        </div>
      )}

      {/* Pending List */}
      {adminTab === 'pending' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Pending Approvals</h2>
          {loading && <p className="text-gray-600">Loading pending books...</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {!loading && !error && pendingBooks.length === 0 && (
            <p className="text-gray-600">No pending books to approve.</p>
          )}
          {!loading && pendingBooks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 border">Title</th>
                    <th className="px-4 py-2 border">Genre</th>
                    <th className="px-4 py-2 border">Author ID</th>
                    <th className="px-4 py-2 border">Uploaded At</th>
                    <th className="px-4 py-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBooks.map(book => (
                    <tr key={book.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{book.title}</td>
                      <td className="px-4 py-2 border">{book.genre || 'Other'}</td>
                      <td className="px-4 py-2 border">{book.author_id.substring(0, 8)}...</td>
                      <td className="px-4 py-2 border">{new Date(book.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 border">
                        <button
                          onClick={() => approveBook(book.id)}
                          disabled={approvingId === book.id}
                          className={`px-4 py-2 rounded text-white transition ${
                            approvingId === book.id
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {approvingId === book.id ? 'Approving...' : 'Approve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={fetchPendingBooks}
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Pending List
          </button>
        </div>
      )}

      {/* Genres */}
      {adminTab === 'genres' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Approved Books by Genre</h2>
          <nav className="bg-blue-100 p-4 shadow mb-8">
            <div className="overflow-x-auto">
              <ul className="flex gap-4 whitespace-nowrap">
                {genres.map(g => (
                  <li key={g}>
                    <button
                      onClick={() => setSelectedGenre(g)}
                      className={`px-6 py-3 rounded font-medium ${
                        selectedGenre === g
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-600 hover:bg-blue-200'
                      }`}
                    >
                      {g}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <h3 className="text-xl font-bold mb-6">{selectedGenre} Books</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {loading && <p className="col-span-full text-center text-gray-600">Loading approved books...</p>}
            {error && <p className="col-span-full text-center text-red-600">Error: {error}</p>}
            {!loading && !error && filteredApprovedBooks.length === 0 ? (
              <p className="col-span-full text-center text-gray-600">No approved books in {selectedGenre} yet.</p>
            ) : (
              filteredApprovedBooks.map(book => {
                const coverUrl = book.cover_path
                  ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                  : 'https://placehold.co/200x300?text=No+Cover'
                console.log('Admin Genres - Book:', book.title, 'cover_path:', book.cover_path, 'generated URL:', coverUrl)
                return (
                  <div key={book.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition">
                    <img
                      src={coverUrl}
                      alt={book.title}
                      className="w-full h-64 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2">{book.title}</h3>
                      <p className="text-gray-600 mb-4">by Author ID: {book.author_id}</p>
                      <button
                        onClick={() => openReader(book)}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
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

      {/* Users Tab */}
      {adminTab === 'users' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Registered Users</h2>
          {loading && <p className="text-gray-600">Loading users...</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {!loading && !error && users.length === 0 && (
            <p className="text-gray-600">No users registered yet.</p>
          )}
          {!loading && users.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="px-4 py-2 border">Email</th>
                    <th className="px-4 py-2 border">Role</th>
                    <th className="px-4 py-2 border">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border">{user.email}</td>
                      <td className="px-4 py-2 border capitalize">{user.role}</td>
                      <td className="px-4 py-2 border">{new Date(user.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={fetchUsers}
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Users List
          </button>
        </div>
      )}

      {selectedBookForReading && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          <div className="p-4 bg-gray-100 border-b">
            <button
              onClick={closeReader}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Back to List
            </button>
          </div>
          <div className="p-4">
            <SecureReader bookPath={selectedBookForReading.file_path} />
          </div>
        </div>
      )}
    </div>
  )
}