import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FaHeart,
  FaComment,
  FaBookmark,
  FaEllipsisH,
  FaEdit,
  FaTrash,
  FaFlag,
  FaSmile,
  FaRetweet,
  FaQuoteRight,
  FaLink,
  FaEye,
} from 'react-icons/fa'
import ReportModal from './ReportModal'
import PollCard from './PollCard'
import QuoteModal from './QuoteModal'
import { formatDistanceToNow } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'
import type { Post, Poll } from '../types'

interface PostCardProps {
  post: Post
  onDelete?: (id: string) => void
  onEdit?: (id: string, data: { content: string; images: string[] }) => void
  onQuote?: (post: Post) => void
}

// Must match VALID_EMOJIS in server/src/routes/reactions.ts
const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👍']

// Cache of resolved mention handles -> user ids ('' = lookup failed/not found)
const mentionCache = new Map<string, string>()

// Renders post/comment text with clickable #hashtags and @mentions.
function RichText({ content }: { content: string }) {
  const [mentions, setMentions] = useState<Record<string, string>>({})

  useEffect(() => {
    const handles = new Set(
      (content.match(/@(\w+)/g) || []).map((m) => m.slice(1).toLowerCase())
    )
    handles.forEach(async (handle) => {
      if (mentionCache.has(handle)) {
        const cached = mentionCache.get(handle)!
        if (cached) setMentions((prev) => ({ ...prev, [handle]: cached }))
        return
      }
      try {
        const res = await api.get(`/users/username/${handle}`)
        mentionCache.set(handle, res.data.user._id)
        setMentions((prev) => ({ ...prev, [handle]: res.data.user._id }))
      } catch {
        mentionCache.set(handle, '')
      }
    })
  }, [content])

  const parts = content.split(/(\s+)/)
  return (
    <>
      {parts.map((part, i) => {
        if (/^#\w+$/.test(part) && part.length > 1) {
          return (
            <Link key={i} to={`/hashtag/${part.slice(1)}`} className="text-blue-400 hover:underline">
              {part}
            </Link>
          )
        }
        if (/^@\w+$/.test(part) && part.length > 1) {
          const handle = part.slice(1).toLowerCase()
          const userId = mentions[handle]
          return userId ? (
            <Link key={i} to={`/profile/${userId}`} className="text-blue-400 hover:underline">
              {part}
            </Link>
          ) : (
            <span key={i} className="text-blue-400/70">{part}</span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function PostCard({ post, onDelete, onEdit, onQuote }: PostCardProps) {
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
  const [showReport, setShowReport] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [userReaction, setUserReaction] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  // Poll state
  const [poll, setPoll] = useState<Poll | undefined>(post.poll)

  // Repost / Quote state
  const [reposted, setReposted] = useState(false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [shareCount, setShareCount] = useState(post.shareCount || 0)
  const [showRepostMenu, setShowRepostMenu] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)

  // Check repost status on mount
  useEffect(() => {
    let mounted = true
    if (user?._id && post._id) {
      api
        .get(`/reposts/check/${post._id}`)
        .then((res) => {
          if (mounted) setReposted(res.data.reposted)
        })
        .catch(() => {})
    }
    return () => {
      mounted = false
    }
  }, [post._id, user?._id])

  const handleLike = async () => {
    try {
      await api.post(`/posts/${post._id}/like`)
      setLiked(!liked)
      setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
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
    if (bookmarkLoading) return
    setBookmarkLoading(true)
    try {
      const res = await api.post(`/posts/${post._id}/bookmark`)
      setBookmarked(res.data.bookmarked)
    } catch (error) {
      console.error('Failed to toggle bookmark')
    } finally {
      setBookmarkLoading(false)
    }
  }

  const handleCopyLink = () => {
    setShowMenu(false)
    const url = `${window.location.origin}/post/${post._id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Toggle Repost
  const handleToggleRepost = async () => {
    setShowRepostMenu(false)
    try {
      const res = await api.post(`/reposts/${post._id}`)
      setReposted(res.data.reposted)
      setShareCount(res.data.shareCount)
    } catch (error) {
      console.error('Failed to toggle repost')
    }
  }

  // Load reaction counts and user reaction
  useEffect(() => {
    let mounted = true
    api
      .get(`/reactions/${post._id}`)
      .then((res) => {
        if (!mounted) return
        const grouped = res.data.reactions as Record<string, { _id: string }[]>
        const counts: Record<string, number> = {}
        let own: string | null = null
        for (const [emoji, users] of Object.entries(grouped)) {
          counts[emoji] = users.length
          if (users.some((u) => u._id === user?._id)) own = emoji
        }
        setReactionCounts(counts)
        setUserReaction(own)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [post._id, user?._id])

  const handleReact = async (emoji: string) => {
    setShowReactionPicker(false)
    try {
      const res = await api.post(`/reactions/${post._id}`, { emoji })
      setReactionCounts(res.data.reactionCounts || {})
      setUserReaction(res.data.reacted ? res.data.emoji : null)
    } catch (error) {
      console.error('Failed to react to post')
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(post.content)
  }

  return (
    <article className="border-b border-gray-800 p-4 hover:bg-gray-950 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.author._id}`}>
            <Avatar src={post.author.avatar} name={post.author.displayName} />
          </Link>
          <div>
            <Link to={`/profile/${post.author._id}`} className="font-semibold hover:underline text-white leading-tight">
              {post.author.displayName}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Link to={`/profile/${post.author._id}`} className="hover:underline truncate max-w-[120px]">
                @{post.author.username}
              </Link>
              <span>·</span>
              <Link to={`/post/${post._id}`} className="hover:underline text-gray-500">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </Link>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-500 hover:text-gray-300 p-2 rounded-full hover:bg-gray-800"
          >
            <FaEllipsisH />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-black shadow-xl rounded-xl border border-gray-700 py-1 z-10 min-w-[140px]">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white hover:bg-gray-900"
              >
                <FaLink size={12} /> {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
              {user?._id === post.author._id ? (
                <>
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white hover:bg-gray-900"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-gray-900"
                  >
                    <FaTrash /> Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowReport(true)
                    setShowMenu(false)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-gray-900"
                >
                  <FaFlag /> Report
                </button>
              )}
            </div>
          )}
        </div>
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
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
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
        <p className="mb-3 whitespace-pre-wrap text-white">
          {post.content && <RichText content={post.content} />}
        </p>
      )}

      {/* Poll */}
      {poll && (
        <PollCard
          poll={poll}
          postId={post._id}
          onVote={(updatedPoll) => setPoll(updatedPoll)}
        />
      )}

      {/* Image Carousel */}
      {post.images && post.images.length > 0 && (
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

      {/* Embedded Quoted Post */}
      {post.quotedPost && (
        <div className="my-3 border border-gray-800 hover:border-gray-700 rounded-2xl p-3 bg-gray-950/60 transition-colors">
          <Link to={`/post/${post.quotedPost._id}`} className="flex items-center gap-2 mb-2">
            <Avatar src={post.quotedPost.author.avatar} name={post.quotedPost.author.displayName} size="sm" />
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-xs text-white hover:underline truncate">
                {post.quotedPost.author.displayName}
              </span>
              <span className="text-xs text-gray-500 truncate">@{post.quotedPost.author.username}</span>
            </div>
          </Link>
          {post.quotedPost.content && (
            <p className="text-sm text-gray-200 mb-2 whitespace-pre-wrap">
              <RichText content={post.quotedPost.content} />
            </p>
          )}
          {post.quotedPost.poll && (
            <PollCard
              poll={post.quotedPost.poll}
              postId={post.quotedPost._id}
            />
          )}
          {post.quotedPost.images && post.quotedPost.images.length > 0 && (
            <div className="rounded-xl overflow-hidden max-h-48 border border-gray-800/80">
              <img src={post.quotedPost.images[0]} alt="" className="w-full h-48 object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-500 mt-1">
        {/* Like */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 hover:text-red-500 transition-colors ${
            liked ? 'text-red-500' : ''
          }`}
        >
          <FaHeart fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 hover:text-blue-500 transition-colors"
        >
          <FaComment />
          <span>{comments.length}</span>
        </button>

        {/* Emoji Reactions */}
        <div className="relative">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className={`flex items-center gap-1.5 hover:text-pink-500 transition-colors ${
              userReaction ? 'text-pink-500' : ''
            }`}
            title="React"
          >
            {userReaction ? <span className="text-base leading-none">{userReaction}</span> : <FaSmile />}
          </button>
          {showReactionPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowReactionPicker(false)} />
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 bg-black border border-gray-700 rounded-full px-3 py-2 flex gap-1.5 shadow-xl">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`text-2xl hover:scale-125 transition-transform ${
                      userReaction === emoji ? 'scale-110' : ''
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Repost / Quote Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowRepostMenu(!showRepostMenu)}
            className={`flex items-center gap-1.5 hover:text-green-500 transition-colors ${
              reposted ? 'text-green-500 font-medium' : ''
            }`}
            title="Repost or Quote"
          >
            <FaRetweet size={15} />
            <span>{shareCount > 0 ? shareCount : ''}</span>
          </button>

          {showRepostMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowRepostMenu(false)} />
              <div className="absolute bottom-9 left-0 z-20 bg-black border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[140px] text-xs font-semibold">
                <button
                  onClick={handleToggleRepost}
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-gray-900 text-white hover:text-green-400 transition-colors"
                >
                  <FaRetweet size={13} className={reposted ? 'text-green-500' : ''} />
                  <span>{reposted ? 'Undo Repost' : 'Repost'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowRepostMenu(false)
                    setShowQuoteModal(true)
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-gray-900 text-white hover:text-blue-400 transition-colors border-t border-gray-800"
                >
                  <FaQuoteRight size={11} />
                  <span>Quote Post</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Views */}
        {typeof post.viewCount === 'number' && post.viewCount > 0 && (
          <Link
            to={`/post/${post._id}`}
            className="flex items-center gap-1 hover:text-blue-400 transition-colors text-xs"
            title="Views"
          >
            <FaEye size={13} />
            <span>{post.viewCount}</span>
          </Link>
        )}

        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          disabled={bookmarkLoading}
          className={`flex items-center gap-1.5 hover:text-blue-500 transition-colors ml-auto ${
            bookmarked ? 'text-blue-500' : ''
          }`}
        >
          <FaBookmark fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Reaction Counts */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {Object.entries(reactionCounts)
            .filter(([, count]) => count > 0)
            .map(([emoji, count]) => (
              <span key={emoji} className="flex items-center gap-1">
                <span className="text-base leading-none">{emoji}</span>
                <span>{count}</span>
              </span>
            ))}
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          {comments.map((comment) => (
            <div key={comment._id} className="flex gap-2 mb-3">
              <Avatar src={comment.author.avatar} name={comment.author.displayName} size="sm" />
              <div className="flex-1">
                <div className="bg-gray-900 rounded-2xl px-3 py-2">
                  <span className="font-semibold text-sm text-white">{comment.author.displayName}</span>
                  <p className="text-sm text-gray-300">
                    <RichText content={comment.content} />
                  </p>
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

      {/* Quote Modal */}
      {showQuoteModal && (
        <QuoteModal
          targetPost={post}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={(createdQuote) => {
            setShareCount((prev) => prev + 1)
            onQuote?.(createdQuote)
          }}
        />
      )}

      {/* Report Modal */}
      {showReport && (
        <ReportModal targetType="post" targetId={post._id} onClose={() => setShowReport(false)} />
      )}
    </article>
  )
}
