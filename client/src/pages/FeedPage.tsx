import { useState, useEffect, useRef } from 'react'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import PollCreator, { type PollData } from '../components/PollCreator'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../types'
import { FaImage, FaTimes, FaSpinner, FaPollH } from 'react-icons/fa'

export type FeedTab = 'foryou' | 'following'

export default function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState('')
  const [newPostContent, setNewPostContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<FeedTab>('foryou')

  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollData, setPollData] = useState<PollData>({
    options: ['', ''],
    durationHours: 24,
  })

  useEffect(() => {
    fetchPosts()
  }, [tab])

  const fetchPosts = async () => {
    setError('')
    try {
      const res = await api.get('/posts/feed', { params: { tab } })
      setPosts(res.data.posts)
    } catch (err: any) {
      console.error('Failed to fetch posts', err)
      setError(
        err?.response
          ? `The server responded with ${err.response.status}: ${err.response.data?.message || 'Failed to fetch posts'}`
          : 'Could not reach the server. Check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const retryFetchPosts = () => {
    setLoading(true)
    fetchPosts()
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + imageFiles.length > 4) return

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) return
    }

    setImageFiles([...imageFiles, ...files])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return []
    const formData = new FormData()
    imageFiles.forEach((file) => formData.append('images', file))
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.urls
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedContent = newPostContent.trim()
    const validPollOptions = showPollCreator
      ? pollData.options.map((o) => o.trim()).filter(Boolean)
      : []

    if (!trimmedContent && imageFiles.length === 0 && validPollOptions.length < 2) return
    if (showPollCreator && validPollOptions.length < 2) return

    setPosting(true)
    try {
      let imageUrls: string[] = []
      if (imageFiles.length > 0) {
        setUploading(true)
        imageUrls = await uploadImages()
        setUploading(false)
      }

      const payload: any = {
        content: newPostContent,
        images: imageUrls,
      }

      if (showPollCreator && validPollOptions.length >= 2) {
        payload.poll = {
          options: validPollOptions,
          durationHours: pollData.durationHours,
        }
      }

      const res = await api.post('/posts', payload)
      setPosts([res.data, ...posts])
      setNewPostContent('')
      setImageFiles([])
      setImagePreviews([])
      setShowPollCreator(false)
      setPollData({ options: ['', ''], durationHours: 24 })
    } catch (error) {
      setUploading(false)
      console.error('Failed to create post')
    } finally {
      setPosting(false)
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter((p) => p._id !== postId))
  }

  const handleEditPost = (postId: string, data: { content: string; images: string[] }) => {
    setPosts(posts.map((p) => (p._id === postId ? { ...p, ...data } : p)))
  }

  const handleQuoteCreated = (newQuotePost: Post) => {
    setPosts([newQuotePost, ...posts])
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Home</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 sticky top-[57px] bg-black/80 backdrop-blur-md z-10">
        {(
          [
            { key: 'foryou', label: 'For You' },
            { key: 'following', label: 'Following' },
          ] as { key: FeedTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors hover:bg-gray-900 ${
              tab === key ? 'text-white font-bold relative' : 'text-gray-500'
            }`}
          >
            {label}
            {tab === key && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
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

              {/* Poll Creator widget */}
              {showPollCreator && (
                <PollCreator
                  pollData={pollData}
                  onChange={(updated) => setPollData(updated)}
                  onRemove={() => {
                    setShowPollCreator(false)
                    setPollData({ options: ['', ''], durationHours: 24 })
                  }}
                />
              )}

              {imagePreviews.length > 0 && (
                <div className={`grid gap-2 mt-2 ${imagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {imagePreviews.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt="" className="w-full h-24 object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFiles(imageFiles.filter((_, i) => i !== idx))
                          setImagePreviews(imagePreviews.filter((_, i) => i !== idx))
                        }}
                        className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 border border-gray-600"
                      >
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                <div className="flex gap-2 text-blue-500 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:bg-blue-500/10 p-2 rounded-full transition-colors"
                    disabled={imageFiles.length >= 4}
                    title="Add photos"
                  >
                    <FaImage size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPollCreator(!showPollCreator)}
                    className={`p-2 rounded-full transition-colors ${
                      showPollCreator ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-blue-500/10 text-blue-500'
                    }`}
                    title="Create a poll"
                  >
                    <FaPollH size={18} />
                  </button>

                  {imageFiles.length > 0 && (
                    <span className="text-xs text-gray-500">{imageFiles.length}/4</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{newPostContent.length}/280</span>
                  <button
                    type="submit"
                    disabled={
                      posting ||
                      uploading ||
                      (!newPostContent.trim() &&
                        imageFiles.length === 0 &&
                        (!showPollCreator || pollData.options.filter((o) => o.trim()).length < 2))
                    }
                    className="btn-primary text-sm"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-1">
                        <FaSpinner className="animate-spin" /> Uploading...
                      </span>
                    ) : posting ? (
                      'Posting...'
                    ) : (
                      'Post'
                    )}
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
      ) : error ? (
        <div className="text-center py-12 px-6">
          <p className="text-lg font-medium text-red-400">Couldn't load the feed</p>
          <p className="mt-1 text-sm text-gray-500 break-words">{error}</p>
          <button onClick={retryFetchPosts} className="btn-primary text-sm mt-4">
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {tab === 'following' ? (
            <>
              <p className="text-lg font-medium">Nothing here yet</p>
              <p className="mt-1">Follow people from Explore to see their posts here.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No posts yet</p>
              <p className="mt-1">Be the first to share something!</p>
            </>
          )}
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDelete={handleDeletePost}
              onEdit={handleEditPost}
              onQuote={handleQuoteCreated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
