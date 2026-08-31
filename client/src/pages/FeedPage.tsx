import { useState, useEffect, useRef } from 'react'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../types'
import { FaImage, FaTimes } from 'react-icons/fa'

export default function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts/feed')
      setPosts(res.data.posts)
    } catch (error) {
      console.error('Failed to fetch posts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPostContent.trim() && selectedImages.length === 0) return
    setPosting(true)
    try {
      const res = await api.post('/posts', {
        content: newPostContent,
        images: selectedImages,
      })
      setPosts([res.data, ...posts])
      setNewPostContent('')
      setSelectedImages([])
    } catch (error) {
      console.error('Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p._id !== postId))
  }

  const handleEditPost = (postId: string, data: { content: string; images: string[] }) => {
    setPosts(posts.map(p => p._id === postId ? { ...p, ...data } : p))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setSelectedImages(prev => [...prev, ev.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Home</h1>
        </div>
      </div>

      {/* New Post Composer */}
      <div className="border-b border-gray-800 p-4">
        <form onSubmit={handleCreatePost}>
          <div className="flex gap-3">
            <Avatar src={user?.avatar} name={user?.displayName || ''} />
            <div className="flex-1">
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="What's happening?"
                className="w-full resize-none border-none focus:outline-none text-lg placeholder-gray-500 min-h-[80px] bg-transparent text-white"
                maxLength={280}
              />
              {selectedImages.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt="" className="w-20 h-20 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 border border-gray-600"
                      >
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                <div className="flex gap-4 text-blue-500">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="hover:bg-blue-500/10 p-2 rounded-full transition-colors">
                    <FaImage size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {newPostContent.length}/280
                  </span>
                  <button
                    type="submit"
                    disabled={posting || (!newPostContent.trim() && selectedImages.length === 0)}
                    className="btn-primary text-sm"
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Feed */}
      {loading ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No posts yet</p>
          <p className="mt-1">Be the first to share something!</p>
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDeletePost} onEdit={handleEditPost} />
          ))}
        </div>
      )}
    </div>
  )
}
