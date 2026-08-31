import { useState, useEffect } from 'react'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../types'
import { FaBookmark } from 'react-icons/fa'

export default function BookmarksPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?._id) {
      fetchBookmarks()
    }
  }, [user?._id])

  const fetchBookmarks = async () => {
    try {
      const res = await api.get(`/posts/user/${user?._id}/bookmarks`)
      setPosts(res.data.posts)
    } catch (error) {
      console.error('Failed to fetch bookmarks')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p._id !== postId))
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Bookmarks</h1>
        </div>
      </div>

      <div>
        {loading ? (
          <LoadingSpinner />
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaBookmark size={48} className="mx-auto mb-4 text-gray-700" />
            <p className="text-lg font-medium">No bookmarks yet</p>
            <p className="mt-1">Save posts to see them here later</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
          ))
        )}
      </div>
    </div>
  )
}
