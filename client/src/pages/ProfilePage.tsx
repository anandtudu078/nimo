import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { User, Post } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { FaCamera, FaTimes, FaTrash, FaBan, FaFlag } from 'react-icons/fa'
import ReportModal from '../components/ReportModal'

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser, updateUser } = useAuth()
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [likedPosts, setLikedPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', avatar: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    if (userId) {
      fetchProfile()
    }
  }, [userId])

  const fetchProfile = async () => {
    try {
      const [userRes, postsRes, likedRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/posts/user/${userId}`),
        api.get(`/posts/user/${userId}/liked`),
      ])
      setProfileUser(userRes.data.user)
      setPosts(postsRes.data.posts)
      setLikedPosts(likedRes.data.posts)
      setIsFollowing(userRes.data.user.followers.includes(currentUser?._id))
    } catch (error) {
      console.error('Failed to fetch profile')
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async () => {
    try {
      const res = await api.post(`/users/${userId}/block`)
      setIsBlocked(res.data.blocked)
      if (res.data.blocked) {
        // If blocking, also unfollow
        setIsFollowing(false)
      }
    } catch (error) {
      console.error('Failed to block user')
    }
  }

  const handleFollow = async () => {
    try {
      await api.post(`/users/${userId}/follow`)
      setIsFollowing(!isFollowing)
      setProfileUser((prev) => prev ? {
        ...prev,
        followers: isFollowing
          ? prev.followers.filter((id) => id !== currentUser?._id)
          : [...prev.followers, currentUser?._id!],
      } : null)
    } catch (error) {
      console.error('Failed to follow user')
    }
  }

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p._id !== postId))
  }

  const handleEditPost = (postId: string, data: { content: string; images: string[] }) => {
    setPosts(posts.map(p => p._id === postId ? { ...p, ...data } : p))
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (!profileUser) {
    return <div className="text-center py-12 text-gray-500">User not found</div>
  }

  const isOwnProfile = currentUser?._id === userId

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/users/me')
      localStorage.removeItem('token')
      window.location.href = '/login'
    } catch (error) {
      console.error('Failed to delete account')
      alert('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const startEditing = () => {
    setEditForm({
      displayName: profileUser.displayName,
      bio: profileUser.bio || '',
      avatar: profileUser.avatar || '',
    })
    setEditing(true)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await api.put('/users/me', {
        displayName: editForm.displayName,
        bio: editForm.bio,
      })
      setProfileUser(res.data.user)
      updateUser(res.data.user)
      setEditing(false)
    } catch (error) {
      console.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await api.post('/users/avatar', formData)
      setProfileUser(res.data.user)
      updateUser(res.data.user)
      setEditForm((prev) => ({ ...prev, avatar: res.data.avatarUrl }))
    } catch (error) {
      console.error('Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {/* Profile Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">{profileUser.displayName}</h1>
          <p className="text-sm text-gray-500">{posts.length} posts</p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between">
          <div className="relative group">
            <Avatar src={profileUser.avatar} name={profileUser.displayName} size="lg" />
            {isOwnProfile && !editing && (
              <button
                onClick={startEditing}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FaCamera className="text-white" size={24} />
              </button>
            )}
          </div>
          {!isOwnProfile && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFollow}
                className={isFollowing ? 'btn-secondary' : 'btn-primary'}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                onClick={handleBlock}
                className={`p-2 rounded-full border transition-colors ${
                  isBlocked ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-500'
                }`}
                title={isBlocked ? 'Unblock' : 'Block'}
              >
                <FaBan size={16} />
              </button>
              <button
                onClick={() => setShowReport(true)}
                className="p-2 rounded-full border border-gray-700 text-gray-500 hover:text-yellow-500 hover:border-yellow-500 transition-colors"
                title="Report user"
              >
                <FaFlag size={16} />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                className="input-field"
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                className="input-field resize-none"
                rows={3}
                maxLength={160}
                placeholder="Tell us about yourself..."
              />
              <p className="text-xs text-gray-500 mt-1">{editForm.bio.length}/160</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Profile Picture</label>
              <div className="flex items-center gap-4">
                <Avatar src={editForm.avatar || profileUser.avatar} name={editForm.displayName} size="lg" />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <FaCamera size={14} />
                    {uploading ? 'Uploading...' : 'Choose Photo'}
                  </button>
                  {editForm.avatar && (
                    <button
                      type="button"
                      onClick={async () => {
                        setEditForm({ ...editForm, avatar: '' })
                        try {
                          const res = await api.put('/users/me', { avatar: '' })
                          setProfileUser(res.data.user)
                          updateUser(res.data.user)
                        } catch (error) {
                          console.error('Failed to remove avatar')
                        }
                      }}
                      className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1 mt-2"
                    >
                      <FaTimes size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>

            {/* Delete Account Section */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-medium text-red-500 mb-2">Danger Zone</h3>
              {showDeleteConfirm ? (
                <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
                  <p className="text-sm text-red-400 mb-3">
                    Are you sure you want to delete your account? This action cannot be undone. All your posts, followers, and data will be permanently deleted.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400"
                >
                  <FaTrash size={14} />
                  Delete Account
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <h2 className="text-xl font-bold text-white">{profileUser.displayName}</h2>
            <p className="text-gray-500">@{profileUser.username}</p>
            {profileUser.bio && (
              <p className="mt-2 text-gray-300">{profileUser.bio}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Joined {formatDistanceToNow(new Date(profileUser.createdAt), { addSuffix: true })}
            </p>
          </div>
        )}

        <div className="flex gap-6 mt-4">
          <div>
            <span className="font-bold text-white">{profileUser.following?.length || 0}</span>
            <span className="text-gray-500 ml-1">Following</span>
          </div>
          <div>
            <span className="font-bold text-white">{profileUser.followers?.length || 0}</span>
            <span className="text-gray-500 ml-1">Followers</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'posts' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:bg-gray-900'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'likes' ? 'border-b-2 border-blue-500 text-white' : 'text-gray-500 hover:bg-gray-900'
            }`}
          >
            Likes
          </button>
        </div>
      </div>

      {/* Posts */}
      <div>
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No posts yet</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard key={post._id} post={post} onDelete={handleDeletePost} onEdit={handleEditPost} />
            ))
          )
        ) : (
          likedPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No liked posts yet</p>
            </div>
          ) : (
            likedPosts.map((post) => (
              <PostCard key={post._id} post={post} />
            ))
          )
        )}
      </div>
      {showReport && (
        <ReportModal targetType="user" targetId={userId!} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
