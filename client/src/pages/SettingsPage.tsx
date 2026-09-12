import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Avatar from '../components/Avatar'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAuth } from '../contexts/AuthContext'
import { FaCamera, FaTrash, FaBan, FaVolumeMute, FaPlus, FaTimes, FaCheck } from 'react-icons/fa'

interface PublicUser {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-gray-800 px-4 py-6">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-0.5 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()

  const [loading, setLoading] = useState(true)

  // Profile form
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    bio: '',
    website: '',
    studyYear: '',
    avatar: '',
    profileBanner: '',
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Password form
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Privacy
  const [blockedUsers, setBlockedUsers] = useState<PublicUser[]>([])
  const [mutedUsers, setMutedUsers] = useState<PublicUser[]>([])
  const [mutedKeywords, setMutedKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchPrivacy = async () => {
    try {
      const [blockedRes, mutedUsersRes, mutedKeywordsRes] = await Promise.all([
        api.get('/users/me/blocked'),
        api.get('/mutes/users'),
        api.get('/mutes/keywords'),
      ])
      setBlockedUsers(blockedRes.data.blockedUsers || [])
      setMutedUsers(mutedUsersRes.data.mutedUsers || [])
      setMutedKeywords(mutedKeywordsRes.data.mutedKeywords || [])
    } catch (error) {
      console.error('Failed to fetch privacy settings', error)
    }
  }

  useEffect(() => {
    if (!user) return
    setProfileForm({
      displayName: user.displayName || '',
      bio: user.bio || '',
      website: user.website || '',
      studyYear: user.studyYear || '',
      avatar: user.avatar || '',
      profileBanner: (user as any).profileBanner || '',
    })
    fetchPrivacy()
    setLoading(false)
  }, [user])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await api.put('/users/me', profileForm)
      updateUser(res.data.user)
      setProfileForm((prev) => ({ ...prev, ...res.data.user }))
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'avatar' | 'banner'
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    const setUploading = kind === 'avatar' ? setUploadingAvatar : setUploadingBanner
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append(kind, file)
      const res = await api.post(`/users/${kind}`, formData)
      updateUser(res.data.user)
      setProfileForm((prev) => ({
        ...prev,
        ...(kind === 'avatar'
          ? { avatar: res.data.avatarUrl }
          : { profileBanner: res.data.bannerUrl }),
      }))
    } catch (error: any) {
      alert(error?.response?.data?.message || `Failed to upload ${kind}`)
    } finally {
      setUploading(false)
      if (kind === 'avatar' && avatarInputRef.current) avatarInputRef.current.value = ''
      if (kind === 'banner' && bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      await api.put('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordSuccess(true)
    } catch (error: any) {
      setPasswordError(error?.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleUnblock = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/block`)
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId))
    } catch (error) {
      console.error('Failed to unblock user', error)
    }
  }

  const handleUnmute = async (userId: string) => {
    try {
      await api.post(`/mutes/user/${userId}`)
      setMutedUsers((prev) => prev.filter((u) => u._id !== userId))
    } catch (error) {
      console.error('Failed to unmute user', error)
    }
  }

  const handleAddKeyword = async () => {
    const keyword = keywordInput.trim().toLowerCase()
    if (!keyword || mutedKeywords.includes(keyword)) return
    try {
      await api.post('/mutes/keyword', { keyword })
      setMutedKeywords((prev) => [...prev, keyword])
      setKeywordInput('')
    } catch (error) {
      console.error('Failed to mute keyword', error)
    }
  }

  const handleRemoveKeyword = async (keyword: string) => {
    try {
      await api.post('/mutes/keyword', { keyword })
      setMutedKeywords((prev) => prev.filter((k) => k !== keyword))
    } catch (error) {
      console.error('Failed to unmute keyword', error)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/users/me')
      localStorage.removeItem('token')
      window.location.href = '/login'
    } catch (error) {
      console.error('Failed to delete account', error)
      alert('Failed to delete account. Please try again.')
      setDeleting(false)
    }
  }

  if (loading || !user) {
    return <LoadingSpinner />
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-gray-500">@{user.username}</p>
        </div>
      </div>

      {/* Profile */}
      <Section title="Profile" description="Update how you appear to other people on Nimo.">
        {/* Banner */}
        <div className="relative h-32 rounded-xl overflow-hidden bg-gray-900 mb-6">
          {profileForm.profileBanner ? (
            <img src={profileForm.profileBanner} alt="Profile banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-purple-900/40" />
          )}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
          >
            <FaCamera size={12} />
            {uploadingBanner ? 'Uploading...' : 'Change banner'}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleUpload(e, 'banner')}
            className="hidden"
          />
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-4">
          <Avatar src={profileForm.avatar || user.avatar} name={profileForm.displayName || user.displayName} size="lg" />
          <div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <FaCamera size={14} />
              {uploadingAvatar ? 'Uploading...' : 'Change photo'}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e, 'avatar')}
              className="hidden"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
            <input
              type="text"
              value={profileForm.displayName}
              onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
              className="input-field"
              maxLength={50}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
            <textarea
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              className="input-field resize-none"
              rows={3}
              maxLength={160}
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-gray-500 mt-1">{profileForm.bio.length}/160</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Website</label>
            <input
              type="url"
              value={profileForm.website}
              onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
              className="input-field"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Batch / Study Year</label>
            <input
              type="text"
              value={profileForm.studyYear}
              onChange={(e) => setProfileForm({ ...profileForm, studyYear: e.target.value })}
              className="input-field"
              placeholder="e.g. 2024, 2023-2027"
              maxLength={20}
            />
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary">
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </Section>

      {/* Account */}
      <Section title="Account" description="Your login details and password.">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
          <input type="email" value={user.email || ''} readOnly className="input-field opacity-60 cursor-not-allowed" />
          <p className="text-xs text-gray-500 mt-1">Your email can't be changed here.</p>
        </div>

        <h3 className="text-sm font-semibold text-gray-300 mb-3">Change Password</h3>
        <div className="space-y-3 max-w-md">
          {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-sm text-green-400 flex items-center gap-1.5">
              <FaCheck size={12} /> Password updated successfully
            </p>
          )}
          <input
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            placeholder="Current password"
            className="input-field"
            autoComplete="current-password"
          />
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="New password (min 6 characters)"
            className="input-field"
            autoComplete="new-password"
          />
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="Confirm new password"
            className="input-field"
            autoComplete="new-password"
          />
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy" description="Manage the accounts and words you don't want to see.">
        {/* Blocked */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <FaBan size={12} /> Blocked accounts ({blockedUsers.length})
          </h3>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't blocked anyone.</p>
          ) : (
            <div className="space-y-1">
              {blockedUsers.map((u) => (
                <div key={u._id} className="flex items-center gap-3 py-2">
                  <Avatar src={u.avatar} name={u.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${u._id}`} className="font-medium text-white hover:underline truncate block">
                      {u.displayName}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                  </div>
                  <button onClick={() => handleUnblock(u._id)} className="btn-secondary text-xs">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Muted users */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <FaVolumeMute size={12} /> Muted accounts ({mutedUsers.length})
          </h3>
          {mutedUsers.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't muted anyone.</p>
          ) : (
            <div className="space-y-1">
              {mutedUsers.map((u) => (
                <div key={u._id} className="flex items-center gap-3 py-2">
                  <Avatar src={u.avatar} name={u.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${u._id}`} className="font-medium text-white hover:underline truncate block">
                      {u.displayName}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                  </div>
                  <button onClick={() => handleUnmute(u._id)} className="btn-secondary text-xs">
                    Unmute
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Muted keywords */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Muted words ({mutedKeywords.length})</h3>
          <div className="flex gap-2 max-w-md mb-3">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddKeyword()
                }
              }}
              placeholder="Add a word or phrase to mute"
              className="input-field"
            />
            <button onClick={handleAddKeyword} disabled={!keywordInput.trim()} className="btn-primary flex items-center gap-1.5">
              <FaPlus size={12} /> Add
            </button>
          </div>
          {mutedKeywords.length === 0 ? (
            <p className="text-sm text-gray-500">No muted words.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mutedKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-full px-3 py-1 text-sm text-gray-300"
                >
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="text-gray-500 hover:text-red-400"
                    title={`Unmute "${keyword}"`}
                  >
                    <FaTimes size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <h3 className="text-sm font-medium text-red-500 mb-2">Delete account</h3>
        {showDeleteConfirm ? (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4 max-w-lg">
            <p className="text-sm text-red-400 mb-3">
              Are you sure you want to delete your account? This action cannot be undone. All your posts, followers,
              and data will be permanently deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary text-sm">
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
      </Section>

      <div className="px-4 py-6">
        <button onClick={() => navigate(`/profile/${user._id}`)} className="text-sm text-gray-500 hover:text-white">
          ← Back to profile
        </button>
      </div>
    </div>
  )
}
