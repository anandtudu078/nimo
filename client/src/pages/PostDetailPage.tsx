import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  FaArrowLeft,
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
  FaCheck,
  FaEye,
  FaSpinner,
} from 'react-icons/fa'
import { format, formatDistanceToNow } from 'date-fns'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import PollCard from '../components/PollCard'
import QuoteModal from '../components/QuoteModal'
import ReportModal from '../components/ReportModal'
import type { Post, Poll, Comment } from '../types'

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👍']
const mentionCache = new Map<string, string>()

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

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const commentInputRef = useRef<HTMLTextAreaElement>(null)

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Interactions state
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Poll & Repost state
  const [poll, setPoll] = useState<Poll | undefined>(undefined)
  const [reposted, setReposted] = useState(false)
  const [shareCount, setShareCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)

  // Menus & Modals
  const [showMenu, setShowMenu] = useState(false)
  const [showRepostMenu, setShowRepostMenu] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({})
  const [userReaction, setUserReaction] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Follow state for post author
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchPost(id)
    recordView(id)
  }, [id])

  const fetchPost = async (postId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/posts/${postId}`)
      const postData: Post = res.data.post
      setPost(postData)
      setLiked(postData.likes.includes(user?._id || ''))
      setLikeCount(postData.likes.length)
      setComments(postData.comments || [])
      setPoll(postData.poll)
      setShareCount(postData.shareCount || 0)
      setViewCount(postData.viewCount || 0)
      setEditContent(postData.content)

      // Fetch repost status
      if (user?._id) {
        api
          .get(`/reposts/check/${postId}`)
          .then((r) => setReposted(r.data.reposted))
          .catch(() => {})
      }

      // Fetch reactions
      api
        .get(`/reactions/${postId}`)
        .then((r) => {
          const grouped = r.data.reactions as Record<string, { _id: string }[]>
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

      // Check author follow status
      if (user?._id && postData.author._id !== user._id) {
        api
          .get(`/users/${postData.author._id}`)
          .then((uRes) => {
            setIsFollowing(uRes.data.user?.followers?.includes(user._id) || false)
          })
          .catch(() => {})
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Post not found')
    } finally {
      setLoading(false)
    }
  }

  const recordView = async (postId: string) => {
    try {
      const res = await api.post(`/views/${postId}`)
      if (res.data.counted && typeof res.data.viewCount === 'number') {
        setViewCount(res.data.viewCount)
      }
    } catch {
      // Views tracking errors are non-blocking
    }
  }

  const handleLike = async () => {
    if (!post) return
    try {
      await api.post(`/posts/${post._id}/like`)
      setLiked(!liked)
      setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
    } catch (err) {
      console.error('Failed to like post', err)
    }
  }

  const handleReact = async (emoji: string) => {
    if (!post) return
    setShowReactionPicker(false)
    try {
      const res = await api.post(`/reactions/${post._id}`, { emoji })
      setReactionCounts(res.data.reactionCounts || {})
      setUserReaction(res.data.reacted ? res.data.emoji : null)
    } catch (err) {
      console.error('Failed to react', err)
    }
  }

  const handleToggleRepost = async () => {
    if (!post) return
    setShowRepostMenu(false)
    try {
      const res = await api.post(`/reposts/${post._id}`)
      setReposted(res.data.reposted)
      setShareCount(res.data.shareCount)
    } catch (err) {
      console.error('Failed to toggle repost', err)
    }
  }

  const handleBookmark = async () => {
    if (!post) return
    try {
      const res = await api.post(`/posts/${post._id}/bookmark`)
      setBookmarked(res.data.bookmarked)
    } catch (err) {
      console.error('Failed to bookmark', err)
    }
  }

  const handleCopyLink = () => {
    setShowMenu(false)
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!post || !commentText.trim()) return
    setSubmittingComment(true)
    try {
      const res = await api.post(`/posts/${post._id}/comment`, { content: commentText.trim() })
      setComments([...comments, res.data])
      setCommentText('')
    } catch (err) {
      console.error('Failed to add comment', err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeletePost = async () => {
    if (!post) return
    setShowMenu(false)
    if (window.confirm('Delete this post permanently?')) {
      try {
        await api.delete(`/posts/${post._id}`)
        navigate('/feed')
      } catch (err) {
        console.error('Failed to delete post', err)
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!post || !editContent.trim()) return
    setEditSaving(true)
    try {
      const res = await api.put(`/posts/${post._id}`, { content: editContent.trim() })
      setPost({ ...post, content: res.data.content, images: res.data.images })
      setIsEditing(false)
    } catch (err) {
      console.error('Failed to edit post', err)
    } finally {
      setEditSaving(false)
    }
  }

  const handleFollowToggle = async () => {
    if (!post || followLoading) return
    setFollowLoading(true)
    try {
      await api.post(`/users/${post.author._id}/follow`)
      setIsFollowing(!isFollowing)
    } catch (err) {
      console.error('Failed to toggle follow', err)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div>
        <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 p-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors">
            <FaArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">Post</h1>
        </div>
        <div className="text-center py-20 px-4">
          <p className="text-xl font-semibold text-white mb-2">{error || 'Post not found'}</p>
          <p className="text-gray-500 mb-6">This post may have been deleted or does not exist.</p>
          <button onClick={() => navigate('/feed')} className="btn-primary">
            Back to Home Feed
          </button>
        </div>
      </div>
    )
  }

  const isAuthor = user?._id === post.author._id

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors"
          >
            <FaArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white">Post</h1>
        </div>

        {copiedLink && (
          <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full font-medium flex items-center gap-1.5 animate-in fade-in">
            <FaCheck size={10} /> Link Copied!
          </span>
        )}
      </div>

      <div className="p-4 border-b border-gray-800">
        {/* Author Header */}
        <div className="flex items-center justify-between mb-4">
          <Link to={`/profile/${post.author._id}`} className="flex items-center gap-3">
            <Avatar src={post.author.avatar} name={post.author.displayName} size="md" />
            <div>
              <p className="font-bold text-white hover:underline text-base leading-tight">
                {post.author.displayName}
              </p>
              <p className="text-sm text-gray-500">@{post.author.username}</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!isAuthor && (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-colors ${
                  isFollowing
                    ? 'border border-gray-700 text-white hover:border-red-600 hover:text-red-500'
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-500 hover:text-gray-300 p-2 rounded-full hover:bg-gray-800 transition-colors"
              >
                <FaEllipsisH />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-10 bg-black shadow-2xl rounded-xl border border-gray-700 py-1 z-20 min-w-[150px]">
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-white hover:bg-gray-900"
                  >
                    <FaLink size={13} /> Copy Link
                  </button>
                  {isAuthor ? (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(true)
                          setShowMenu(false)
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-white hover:bg-gray-900"
                      >
                        <FaEdit size={13} /> Edit
                      </button>
                      <button
                        onClick={handleDeletePost}
                        className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 hover:bg-gray-900"
                      >
                        <FaTrash size={13} /> Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setShowReport(true)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 hover:bg-gray-900"
                    >
                      <FaFlag size={13} /> Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mb-4">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-black text-white text-base"
              rows={4}
              maxLength={280}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500">{editContent.length}/280</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditContent(post.content)
                  }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving || !editContent.trim()}
                  className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xl font-normal leading-relaxed text-white mb-4 whitespace-pre-wrap">
            {post.content && <RichText content={post.content} />}
          </p>
        )}

        {/* Poll */}
        {poll && (
          <div className="mb-4">
            <PollCard poll={poll} postId={post._id} onVote={(updated) => setPoll(updated)} />
          </div>
        )}

        {/* Image Carousel */}
        {post.images && post.images.length > 0 && (
          <div className="relative mb-4 rounded-2xl overflow-hidden border border-gray-800 max-h-[500px]">
            <img
              src={post.images[currentImageIndex]}
              alt="Post media"
              className="w-full object-contain max-h-[500px] bg-black"
            />
            {post.images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                {post.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentImageIndex ? 'bg-blue-500' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quoted Post */}
        {post.quotedPost && (
          <div className="mb-4 border border-gray-800 hover:border-gray-700 rounded-2xl p-3.5 bg-gray-950/60 transition-colors">
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
            {post.quotedPost.images && post.quotedPost.images.length > 0 && (
              <div className="rounded-xl overflow-hidden max-h-48 border border-gray-800">
                <img src={post.quotedPost.images[0]} alt="" className="w-full h-48 object-cover" />
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-500 py-3 border-y border-gray-800 flex items-center justify-between">
          <span>{format(new Date(post.createdAt), 'h:mm a · MMM d, yyyy')}</span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <FaEye size={13} />
            <span>{viewCount} {viewCount === 1 ? 'View' : 'Views'}</span>
          </span>
        </div>

        {/* Metrics summary */}
        {(likeCount > 0 || shareCount > 0 || comments.length > 0) && (
          <div className="flex items-center gap-6 py-3 border-b border-gray-800 text-sm text-gray-400">
            {likeCount > 0 && (
              <span>
                <strong className="text-white font-bold">{likeCount}</strong> {likeCount === 1 ? 'Like' : 'Likes'}
              </span>
            )}
            {shareCount > 0 && (
              <span>
                <strong className="text-white font-bold">{shareCount}</strong> {shareCount === 1 ? 'Repost' : 'Reposts'}
              </span>
            )}
            {comments.length > 0 && (
              <span>
                <strong className="text-white font-bold">{comments.length}</strong> {comments.length === 1 ? 'Comment' : 'Comments'}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between py-2 text-gray-500">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`p-2.5 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors ${
              liked ? 'text-red-500' : ''
            }`}
            title="Like"
          >
            <FaHeart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>

          {/* Comment */}
          <button
            onClick={() => commentInputRef.current?.focus()}
            className="p-2.5 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
            title="Reply"
          >
            <FaComment size={18} />
          </button>

          {/* Reactions */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className={`p-2.5 rounded-full hover:bg-pink-500/10 hover:text-pink-500 transition-colors ${
                userReaction ? 'text-pink-500' : ''
              }`}
              title="React"
            >
              {userReaction ? <span className="text-lg leading-none">{userReaction}</span> : <FaSmile size={18} />}
            </button>
            {showReactionPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowReactionPicker(false)} />
                <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 bg-black border border-gray-700 rounded-full px-3 py-2 flex gap-1.5 shadow-xl">
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

          {/* Repost / Quote */}
          <div className="relative">
            <button
              onClick={() => setShowRepostMenu(!showRepostMenu)}
              className={`p-2.5 rounded-full hover:bg-green-500/10 hover:text-green-500 transition-colors ${
                reposted ? 'text-green-500 font-medium' : ''
              }`}
              title="Repost or Quote"
            >
              <FaRetweet size={18} />
            </button>
            {showRepostMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowRepostMenu(false)} />
                <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 bg-black border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[140px] text-xs font-semibold">
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

          {/* Bookmark */}
          <button
            onClick={handleBookmark}
            className={`p-2.5 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors ${
              bookmarked ? 'text-blue-500' : ''
            }`}
            title="Bookmark"
          >
            <FaBookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
          </button>

          {/* Share */}
          <button
            onClick={handleCopyLink}
            className="p-2.5 rounded-full hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
            title="Copy Link"
          >
            <FaLink size={16} />
          </button>
        </div>

        {/* Reaction breakdown badge */}
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
      </div>

      {/* Reply Composer */}
      <div className="p-4 border-b border-gray-800">
        <form onSubmit={handleCommentSubmit}>
          <div className="flex gap-3">
            <Avatar src={user?.avatar} name={user?.displayName || ''} size="sm" />
            <div className="flex-1">
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={`Reply to @${post.author.username}...`}
                className="w-full resize-none border-none focus:outline-none text-base placeholder-gray-500 min-h-[60px] bg-transparent text-white"
                maxLength={500}
              />
              <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
                <span className="text-xs text-gray-500">{commentText.length}/500</span>
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
                >
                  {submittingComment ? (
                    <span className="flex items-center gap-1">
                      <FaSpinner className="animate-spin" /> Replying...
                    </span>
                  ) : (
                    'Reply'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Comments Thread */}
      <div>
        <div className="px-4 py-3 text-sm font-bold text-gray-400 border-b border-gray-800/60">
          Replies ({comments.length})
        </div>

        {comments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-base font-medium">No replies yet</p>
            <p className="text-xs mt-1">Be the first to reply to this conversation!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment._id}
              className="p-4 border-b border-gray-800 flex gap-3 hover:bg-gray-950/40 transition-colors"
            >
              <Link to={`/profile/${comment.author._id}`}>
                <Avatar src={comment.author.avatar} name={comment.author.displayName} size="sm" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/profile/${comment.author._id}`} className="font-semibold text-sm text-white hover:underline truncate">
                    {comment.author.displayName}
                  </Link>
                  <span className="text-xs text-gray-500 truncate">@{comment.author.username}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">
                  <RichText content={comment.content} />
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showQuoteModal && (
        <QuoteModal
          targetPost={post}
          onClose={() => setShowQuoteModal(false)}
          onSuccess={() => {
            setShareCount((prev) => prev + 1)
          }}
        />
      )}

      {showReport && (
        <ReportModal targetType="post" targetId={post._id} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
