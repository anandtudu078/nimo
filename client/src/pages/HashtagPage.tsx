import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import api from '../services/api'
import type { Post } from '../types'

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tag) fetchPosts()
  }, [tag])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/posts/hashtag/${tag}`)
      setPosts(res.data.posts)
    } catch (error) {
      console.error('Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter((p) => p._id !== postId))
  }

  const handleEditPost = (postId: string, data: { content: string; images: string[] }) => {
    setPosts(posts.map((p) => (p._id === postId ? { ...p, ...data } : p)))
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">#{tag}</h1>
          <p className="text-sm text-gray-500">{posts.length} posts</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No posts with #{tag}</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post._id} post={post} onDelete={handleDeletePost} onEdit={handleEditPost} />
        ))
      )}
    </div>
  )
}
