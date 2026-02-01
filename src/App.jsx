import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import BookUpload from './components/BookUpload'
import AdminDashboard from './components/AdminDashboard'
import SecureReader from './components/SecureReader'
// Genres list
const genres = ['Sci-Fi', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Thriller', 'Historical', 'Biography', 'Self-Help', 'Poetry', 'Young Adult', 'Business', 'Science', 'Travel', 'Cooking', 'Art', 'Religion', 'Health', 'Other']
function App() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupRole, setSignupRole] = useState('reader')
  const [loading, setLoading] = useState(false)
  const [books, setBooks] = useState([])
  const [selectedGenre, setSelectedGenre] = useState('Home')
  const [readerTab, setReaderTab] = useState('home')
  const [authorTab, setAuthorTab] = useState('home')
  const [selectedBookForReading, setSelectedBookForReading] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRole(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserRole(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])
  const fetchUserRole = async (userId) => {
    const { data } = await supabase.from('users').select('role').eq('id', userId).single()
    setUserRole(data?.role || 'reader')
  }
  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, genre, author_id, file_path, cover_path, status, created_at')  // explicit + cover_path
      .eq('status', 'approved')
    if (error) {
      console.error('Fetch books error:', error)
      return
    }
    console.log('Fetched books full objects:', data)  // full objects
    setBooks(data || [])
  }
  useEffect(() => {
    if (user) fetchBooks()
  }, [user])
  const handleSignup = async () => {
    setLoading(true)
    const selectedRole = signupRole === 'author' ? 'author' : 'reader'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: selectedRole } }
    })
    if (error) {
      alert('Error: ' + error.message)
    } else {
      await supabase.from('users').insert({
        id: data.user.id,
        email: data.user.email,
        role: selectedRole,
        balance: 0
      })
      alert('Account created! Check email for confirmation.')
    }
    setLoading(false)
  }
  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Error: ' + error.message)
    setLoading(false)
  }
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }
  const openReader = (book) => {
    setSelectedBookForReading(book)
  }
  const closeReader = () => {
    setSelectedBookForReading(null)
  }
  const filteredBooks = selectedGenre === 'Home' ? [] : books.filter(book => book.genre === selectedGenre)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <h1 className="text-3xl font-bold text-center mb-8 text-blue-800">SafeRead KE</h1>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
          <div className="mb-6 text-center">
            <p className="mb-2 font-semibold">Choose account type (permanent):</p>
            <label className="mr-6">
              <input type="radio" name="role" value="reader" checked={signupRole === 'reader'} onChange={(e) => setSignupRole(e.target.value)} />
              Reader
            </label>
            <label>
              <input type="radio" name="role" value="author" checked={signupRole === 'author'} onChange={(e) => setSignupRole(e.target.value)} />
              Author
            </label>
          </div>
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-blue-500 text-white py-3 rounded mb-3 hover:bg-blue-600 transition"
          >
            {loading ? 'Loading...' : 'Create Account'}
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-500 text-white py-3 rounded hover:bg-green-600 transition"
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">SafeRead KE</h1>
          <div className="flex items-center gap-4">
            <p>Welcome, {user.email} ({userRole})</p>
            <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 transition">
              Logout
            </button>
          </div>
        </div>
      </header>
      {/* ADMIN */}
      {userRole === 'admin' && (
        <div className="max-w-6xl mx-auto p-8">
          <AdminDashboard />
        </div>
      )}
      {/* AUTHOR */}
      {userRole === 'author' && (
        <div>
          <nav className="bg-blue-100 p-4 shadow">
            <div className="max-w-6xl mx-auto overflow-x-auto">
              <ul className="flex gap-6 whitespace-nowrap">
                <li>
                  <button
                    onClick={() => setAuthorTab('home')}
                    className={`px-6 py-3 rounded font-medium ${authorTab === 'home' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'}`}
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setAuthorTab('upload')}
                    className={`px-6 py-3 rounded font-medium ${authorTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'}`}
                  >
                    Upload
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setAuthorTab('genres')}
                    className={`px-6 py-3 rounded font-medium ${authorTab === 'genres' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'}`}
                  >
                    Genres
                  </button>
                </li>
              </ul>
            </div>
          </nav>
          {authorTab === 'home' && (
            <main className="max-w-6xl mx-auto p-8">
              <h2 className="text-3xl font-bold mb-8 text-center">Author Home</h2>
              <p className="text-center text-gray-600">Welcome! Use Upload to add new books, or Genres to view your approved titles.</p>
            </main>
          )}
          {authorTab === 'upload' && (
            <div className="max-w-4xl mx-auto p-8">
              <BookUpload user={user} />
            </div>
          )}
          {authorTab === 'genres' && (
            <div>
              <nav className="bg-blue-50 p-4 shadow mb-8">
                <div className="max-w-6xl mx-auto overflow-x-auto">
                  <ul className="flex gap-4 whitespace-nowrap">
                    {genres.map(g => (
                      <li key={g}>
                        <button
                          onClick={() => setSelectedGenre(g)}
                          className={`px-6 py-3 rounded font-medium ${
                            selectedGenre === g ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          {g}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
              <main className="max-w-6xl mx-auto p-8">
                <h2 className="text-3xl font-bold mb-8 text-center">{selectedGenre} Books</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {filteredBooks.length === 0 ? (
                    <p className="col-span-full text-center text-gray-600">No books in this genre yet.</p>
                  ) : (
                    filteredBooks.map(book => {
                      const coverUrl = book.cover_path
                        ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                        : 'https://placehold.co/200x300?text=No+Cover'
                      console.log('Author grid - Book:', book.title, 'cover_path:', book.cover_path, 'generated URL:', coverUrl)
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
              </main>
            </div>
          )}
        </div>
      )}
      {/* READER DASHBOARD */}
      {userRole === 'reader' && (
        <div>
          <nav className="bg-blue-100 p-4 shadow">
            <div className="max-w-6xl mx-auto overflow-x-auto">
              <ul className="flex gap-6 whitespace-nowrap">
                <li>
                  <button
                    onClick={() => setReaderTab('home')}
                    className={`px-6 py-3 rounded font-medium ${readerTab === 'home' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'}`}
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setReaderTab('genres')}
                    className={`px-6 py-3 rounded font-medium ${readerTab === 'genres' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'}`}
                  >
                    Genres
                  </button>
                </li>
              </ul>
            </div>
          </nav>
          {readerTab === 'home' && (
            <main className="max-w-6xl mx-auto p-8">
              <h2 className="text-3xl font-bold mb-8 text-center">Home</h2>
              <p className="text-center text-gray-600">Welcome! Browse genres to find books.</p>
            </main>
          )}
          {readerTab === 'genres' && (
            <div>
              <nav className="bg-blue-50 p-4 shadow mb-8">
                <div className="max-w-6xl mx-auto overflow-x-auto">
                  <ul className="flex gap-4 whitespace-nowrap">
                    {genres.map(g => (
                      <li key={g}>
                        <button
                          onClick={() => setSelectedGenre(g)}
                          className={`px-6 py-3 rounded font-medium ${
                            selectedGenre === g ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-200'
                          }`}
                        >
                          {g}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
              <main className="max-w-6xl mx-auto p-8">
                <h2 className="text-3xl font-bold mb-8 text-center">{selectedGenre} Books</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {filteredBooks.length === 0 ? (
                    <p className="col-span-full text-center text-gray-600">No books in this genre yet.</p>
                  ) : (
                    filteredBooks.map(book => {
                      const coverUrl = book.cover_path
                        ? supabase.storage.from('books').getPublicUrl(book.cover_path).data.publicUrl
                        : 'https://placehold.co/200x300?text=No+Cover'
                      console.log('Reader grid - Book:', book.title, 'cover_path:', book.cover_path, 'generated URL:', coverUrl)
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
              </main>
            </div>
          )}
        </div>
      )}
      {/* FULL-PAGE READER VIEW */}
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
export default App