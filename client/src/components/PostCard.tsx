import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaHeart, FaComment, FaShare, FaBookmark, FaEllipsisH } from 'react-icons/fa'
import { formatDistanceToNow } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import type { Post } from '../types'

interface PostCardProps {
  post: Post
  onDelete?: (id: string) => void
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.likes.includes(user?._id || ''))
  const [likeCount, setLikeCount] = useState(post.likes.length)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(post.comments)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

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
    if (window.confirm('Delete this post?')) {
      try {
        await api.delete(`/posts/${post._id}`)
        onDelete?.(post._id)
      } catch (error) {
        console.error('Failed to delete post')
      }
    }
  }

  return (
    <article className="card mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link to={`/profile/${post.author._id}`} className="flex items-center gap-3">
          <Avatar src={post.author.avatar} name={post.author.displayName} />
          <div>
            <p className="font-semibold hover:underline">{post.author.displayName}</p>
            <p className="text-sm text-gray-500">@{post.author.username}</p>
          </div>
        </Link>
        {user?._id === post.author._id && (
          <button onClick={handleDelete} className="text-gray-400 hover:text-red-500">
            <FaEllipsisH />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="mb-3 whitespace-pre-wrap">{post.content}</p>

      {/* Image Carousel */}
      {post.images.length > 0 && (
        <div className="relative mb-3">
          <img
            src={post.images[currentImageIndex]}
            alt="Post"
            className="w-full rounded-xl object-cover max-h-96"
          />
          {post.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {post.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === currentImageIndex ? 'bg-blue-600' : 'bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-500">
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
        <button className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors ml-auto">
          <FaBookmark />
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2 mb-3">
              <Avatar name={comment.author.displayName} size="sm" />
              <div className="flex-1">
                <div className="bg-gray-50 rounded-2xl px-3 py-2">
                  <span className="font-semibold text-sm">{comment.author.displayName}</span>
                  <p className="text-sm">{comment.content}</p>
                </div>
                <p className="text-xs text-gray-400 mt-1 ml-3">
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
