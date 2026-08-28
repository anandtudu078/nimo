import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { User, Post } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { FaCamera, FaTimes } from 'react-icons/fa'

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user: currentUser, updateUser } = useAuth()
  const [profileUser, setProfileUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts')
  const [isFollowing, setIsFollowing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', avatar: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (userId) {
      fetchProfile()
    }
  }, [userId])

  const fetchProfile = async () => {
    try {
      const [userRes, postsRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/posts/user/${userId}`),
      ])
      setProfileUser(userRes.data.user)
      setPosts(postsRes.data.posts)
      setIsFollowing(userRes.data.user.followers.includes(currentUser?._id))
    } catch (error) {
      console.error('Failed to fetch profile')
    } finally {
      setLoading(false)
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

  if (loading) {
    return <LoadingSpinner />
  }

  if (!profileUser) {
    return <div className="text-center py-12 text-gray-500">User not found</div>
  }

  const isOwnProfile = currentUser?._id === userId

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
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-200">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">{profileUser.displayName}</h1>
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
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FaCamera className="text-white" size={24} />
              </button>
            )}
          </div>
          {!isOwnProfile && (
            <button
              onClick={handleFollow}
              className={isFollowing ? 'btn-secondary' : 'btn-primary'}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                className="input-field"
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                className="input-field resize-none"
                rows={3}
                maxLength={160}
                placeholder="Tell us about yourself..."
              />
              <p className="text-xs text-gray-400 mt-1">{editForm.bio.length}/160</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture</label>
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
                      onClick={() => {
                        setEditForm({ ...editForm, avatar: '' })
                        api.put('/users/me', { avatar: '' })
                      }}
                      className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 mt-2"
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
          </div>
        ) : (
          <div className="mt-3">
            <h2 className="text-xl font-bold">{profileUser.displayName}</h2>
            <p className="text-gray-500">@{profileUser.username}</p>
            {profileUser.bio && (
              <p className="mt-2">{profileUser.bio}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Joined {formatDistanceToNow(new Date(profileUser.createdAt), { addSuffix: true })}
            </p>
          </div>
        )}

        <div className="flex gap-6 mt-4">
          <div>
            <span className="font-bold">{profileUser.following?.length || 0}</span>
            <span className="text-gray-500 ml-1">Following</span>
          </div>
          <div>
            <span className="font-bold">{profileUser.followers?.length || 0}</span>
            <span className="text-gray-500 ml-1">Followers</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'posts' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={`flex-1 py-3 text-center font-medium transition-colors ${
              activeTab === 'likes' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Likes
          </button>
        </div>
      </div>

      {/* Posts */}
      <div className="px-4 py-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No posts yet</p>
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
