import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import type { User, Post } from '../types'

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(User | Post)[]>([])
  const [searching, setSearching] = useState(false)
  const [searchType, setSearchType] = useState<'users' | 'posts'>('users')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`)
      setSearchResults(searchType === 'users' ? res.data.users : res.data.posts)
    } catch (error) {
      console.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold mb-3 text-white">Explore</h1>
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users or posts..."
            className="input-field"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setSearchType('users')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                searchType === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setSearchType('posts')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                searchType === 'posts' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Posts
            </button>
          </div>
        </form>
      </div>

      <div>
        {searching ? (
          <LoadingSpinner />
        ) : searchResults.length > 0 ? (
          searchType === 'users' ? (
            (searchResults as User[]).map((user) => (
              <Link
                key={user._id}
                to={`/profile/${user._id}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-900 transition-colors border-b border-gray-800"
              >
                <Avatar src={user.avatar} name={user.displayName} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{user.displayName}</p>
                  <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                </div>
              </Link>
            ))
          ) : (
            (searchResults as Post[]).map((post) => (
              <PostCard key={post._id} post={post} />
            ))
          )
        ) : searchQuery ? (
          <div className="text-center py-12 text-gray-500">
            <p>No results found</p>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Discover new content</p>
            <p className="mt-1">Search for users or posts above</p>
          </div>
        )}
      </div>
    </div>
  )
}
