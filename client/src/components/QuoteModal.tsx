import { useState } from 'react'
import { FaTimes, FaSpinner, FaQuoteLeft } from 'react-icons/fa'
import Avatar from './Avatar'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { Post } from '../types'

interface QuoteModalProps {
  targetPost: Post
  onClose: () => void
  onSuccess?: (createdPost: Post) => void
}

export default function QuoteModal({ targetPost, onClose, onSuccess }: QuoteModalProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError('')
    try {
      const res = await api.post('/posts', {
        content: content.trim(),
        quotedPostId: targetPost._id,
      })
      onSuccess?.(res.data)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to post quote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-black border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <FaQuoteLeft className="text-blue-400" />
            <span>Quote Post</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <form onSubmit={handleQuoteSubmit} className="p-4">
          {error && (
            <div className="mb-3 p-2.5 bg-red-950/50 border border-red-900 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* User composer */}
          <div className="flex gap-3 mb-4">
            <Avatar src={user?.avatar} name={user?.displayName || ''} size="sm" />
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Add your comment..."
                className="w-full resize-none bg-transparent text-white placeholder-gray-500 focus:outline-none text-base min-h-[90px]"
                maxLength={280}
                autoFocus
              />
            </div>
          </div>

          {/* Embedded Original Post Preview */}
          <div className="border border-gray-800 rounded-xl p-3 bg-gray-950/80 mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar src={targetPost.author.avatar} name={targetPost.author.displayName} size="sm" />
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-semibold text-xs text-white truncate">{targetPost.author.displayName}</span>
                <span className="text-xs text-gray-500 truncate">@{targetPost.author.username}</span>
              </div>
            </div>
            {targetPost.content && (
              <p className="text-xs text-gray-300 line-clamp-3 mb-2">{targetPost.content}</p>
            )}
            {targetPost.images && targetPost.images.length > 0 && (
              <div className="rounded-lg overflow-hidden max-h-32 border border-gray-800">
                <img src={targetPost.images[0]} alt="" className="w-full h-32 object-cover" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">{content.length}/280</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-full text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="btn-primary text-sm py-1.5 px-5 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <FaSpinner className="animate-spin text-xs" /> Posting...
                  </span>
                ) : (
                  'Quote Post'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
