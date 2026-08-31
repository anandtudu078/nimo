import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FaHeart, FaComment, FaShare, FaBookmark, FaEllipsisH, FaEdit, FaTrash } from 'react-icons/fa'
import { formatDistanceToNow } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import type { Post } from '../types'

interface PostCardProps {
  post: Post
  onDelete?: (id: string) => void
  onEdit?: (id: string, data: { content: string; images: string[] }) => void
}

export default function PostCard({ post, onDelete, onEdit }: PostCardProps) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.likes.includes(user?._id || ''))
  const [likeCount, setLikeCount] = useState(post.likes.length)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(post.comments)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editSaving, setEditSaving] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleLike = async () => {
    try {
      await api.post(`/posts/${post._id}/like`)
      setLiked(!liked)
      setLikeCount(prev => liked ? prev - 1 : prev + 1)
    } catch (error) {
      console.error('Failed to like post')
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    try {
      const res = await api.post(`/posts/${post._id}/comment`, { content: commentText })
      setComments([...comments, res.data])
      setCommentText('')
    } catch (error) {
      console.error('Failed to add comment')
    }
  }

  const handleDelete = async () => {
    setShowMenu(false)
    if (window.confirm('Delete this post?')) {
      try {
        await api.delete(`/posts/${post._id}`)
        onDelete?.(post._id)
      } catch (error) {
        console.error('Failed to delete post')
      }
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(post.content)
    setShowMenu(false)
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return
    setEditSaving(true)
    try {
      const res = await api.put(`/posts/${post._id}`, { content: editContent })
      onEdit?.(post._id, { content: res.data.content, images: res.data.images })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to edit post')
    } finally {
      setEditSaving(false)
    }
  }

  const handleBookmark = async () => {
    try {
      const res = await api.post(`/posts/${post._id}/bookmark`)
      setBookmarked(res.data.bookmarked)
    } catch (error) {
      console.error('Failed to toggle bookmark')
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(post.content)
  }

  // Render content with clickable hashtags
  const renderedContent = useMemo(() => {
    if (!post.content) return null
    const parts = post.content.split(/(\s+)/)
    return parts.map((part, i) => {
      if (part.startsWith('#') && part.length > 1 && /^#\w+$/.test(part)) {
        const tag = part.slice(1)
        return (
          <Link key={i} to={`/hashtag/${tag}`} className="text-blue-400 hover:underline">
            {part}
          </Link>
        )
      }
      return <span key={i}>{part}</span>
    })
  }, [post.content])

  return (
    <article className="border-b border-gray-800 p-4 hover:bg-gray-950 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link to={`/profile/${post.author._id}`} className="flex items-center gap-3">
          <Avatar src={post.author.avatar} name={post.author.displayName} />
          <div>
            <p className="font-semibold hover:underline text-white">{post.author.displayName}</p>
            <p className="text-sm text-gray-500">@{post.author.username}</p>
          </div>
        </Link>
        {user?._id === post.author._id && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 hover:text-gray-300 p-2 rounded-full hover:bg-gray-800">
              <FaEllipsisH />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 bg-black shadow-xl rounded-xl border border-gray-700 py-1 z-10 min-w-[140px]">
                <button onClick={handleEdit} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white hover:bg-gray-900">
                  <FaEdit /> Edit
                </button>
                <button onClick={handleDelete} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-gray-900">
                  <FaTrash /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="mb-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full p-3 border border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-black text-white placeholder-gray-500"
            rows={3}
            maxLength={280}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-500">{editContent.length}/280</span>
            <div className="flex gap-2">
              <button onClick={handleCancelEdit} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editContent.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-3 whitespace-pre-wrap text-white">{renderedContent}</p>
      )}

      {/* Image Carousel */}
      {post.images.length > 0 && (
        <div className="relative mb-3">
          <img
            src={post.images[currentImageIndex]}
            alt="Post"
            className="w-full rounded-2xl object-cover max-h-96"
          />
          {post.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {post.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentImageIndex ? 'bg-blue-600' : 'bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-500 mt-1">
        <button onClick={handleLike} className={`flex items-center gap-1.5 hover:text-red-500 transition-colors ${liked ? 'text-red-500' : ''}`}>
          <FaHeart fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
          <FaComment />
          <span>{comments.length}</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
          <FaShare />
        </button>
        <button onClick={handleBookmark} className={`flex items-center gap-1.5 hover:text-blue-500 transition-colors ml-auto ${bookmarked ? 'text-blue-500' : ''}`}>
          <FaBookmark fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2 mb-3">
              <Avatar name={comment.author.displayName} size="sm" />
              <div className="flex-1">
                <div className="bg-gray-900 rounded-2xl px-3 py-2">
                  <span className="font-semibold text-sm text-white">{comment.author.displayName}</span>
                  <p className="text-sm text-gray-300">{comment.content}</p>
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-3">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          <form onSubmit={handleComment} className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="input-field text-sm py-2"
            />
            <button type="submit" className="btn-primary text-sm py-2" disabled={!commentText.trim()}>
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
