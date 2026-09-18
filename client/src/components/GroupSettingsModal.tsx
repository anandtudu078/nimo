import { useEffect, useState } from 'react'
import { FaTimes, FaSpinner, FaCheck, FaUserMinus, FaUserPlus, FaSignOutAlt } from 'react-icons/fa'
import api from '../services/api'
import Avatar from './Avatar'
import { getErrorMessage } from '../utils/errors'

interface GroupMember {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

interface GroupSettingsModalProps {
  conversationId: string
  groupName: string
  adminIds: string[]
  participants: GroupMember[]
  currentUserId: string
  onClose: () => void
  // Parent applies the server's conversation payload to its state
  onUpdated: (conversation: any) => void
  onLeft: () => void
}

export default function GroupSettingsModal({
  conversationId,
  groupName,
  adminIds,
  participants,
  currentUserId,
  onClose,
  onUpdated,
  onLeft,
}: GroupSettingsModalProps) {
  const isAdmin = adminIds.includes(currentUserId)
  const memberIds = new Set(participants.map((p) => p._id))

  const [name, setName] = useState(groupName)
  const [renaming, setRenaming] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')

  // Add-member picker (admin only)
  const [showAdd, setShowAdd] = useState(false)
  const [connections, setConnections] = useState<GroupMember[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  useEffect(() => {
    if (!showAdd || !isAdmin) return
    const fetchConnections = async () => {
      setConnectionsLoading(true)
      try {
        const res = await api.get('/connections')
        const all = res.data.connections.map((c: any) => c.user)
        // Only offer people who aren't in the group yet
        setConnections(all.filter((u: GroupMember) => !memberIds.has(u._id)))
      } catch (err: any) {
        setError(getErrorMessage(err, "Couldn't load your connections"))
      } finally {
        setConnectionsLoading(false)
      }
    }
    fetchConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAdd])

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === groupName) return

    setRenaming(true)
    setError('')
    setNameSaved(false)
    try {
      const res = await api.put(`/messages/groups/${conversationId}`, { name: trimmed })
      onUpdated(res.data.conversation)
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to rename group'))
    } finally {
      setRenaming(false)
    }
  }

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    setError('')
    try {
      const res = await api.delete(`/messages/groups/${conversationId}/members/${userId}`)
      onUpdated(res.data.conversation)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to remove member'))
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdd = async (userId: string) => {
    setAddingId(userId)
    setError('')
    try {
      const res = await api.post(`/messages/groups/${conversationId}/members`, { userId })
      onUpdated(res.data.conversation)
      // Drop the added user from the picker
      setConnections((prev) => prev.filter((u) => u._id !== userId))
      setShowAdd(false)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to add member'))
    } finally {
      setAddingId(null)
    }
  }

  const handleLeave = async () => {
    setLeaving(true)
    setError('')
    try {
      await api.post(`/messages/groups/${conversationId}/leave`)
      onLeft()
      onClose()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to leave group'))
      setLeaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-black border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="font-bold text-white text-base">Group settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-2.5 bg-red-950/50 border border-red-900 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Rename (admin only) */}
          {isAdmin && (
            <form onSubmit={handleRename}>
              <label className="block text-sm text-gray-400 mb-2">Group name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  className="input-field flex-1"
                />
                <button
                  type="submit"
                  disabled={renaming || !name.trim() || name.trim() === groupName}
                  className="btn-primary px-4 disabled:opacity-50"
                  title="Save name"
                >
                  {renaming ? (
                    <FaSpinner className="animate-spin" />
                  ) : nameSaved ? (
                    <FaCheck />
                  ) : (
                    <FaCheck />
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">
                Members ({participants.length})
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <FaUserPlus size={12} />
                  Add
                </button>
              )}
            </div>

            {/* Add-member picker */}
            {isAdmin && showAdd && (
              <div className="mb-3 border border-gray-800 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-800/60">
                {connectionsLoading ? (
                  <div className="p-3 flex justify-center">
                    <FaSpinner className="animate-spin text-gray-500" />
                  </div>
                ) : connections.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500 text-center">
                    No connections left to add
                  </p>
                ) : (
                  connections.map((u) => (
                    <button
                      type="button"
                      key={u._id}
                      onClick={() => handleAdd(u._id)}
                      disabled={addingId !== null}
                      className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-900 transition-colors"
                    >
                      <Avatar src={u.avatar} name={u.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate text-white">{u.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                      </div>
                      {addingId === u._id && (
                        <FaSpinner className="animate-spin text-gray-500" size={12} />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="space-y-1">
              {participants.map((p) => {
                const isSelf = p._id === currentUserId
                const pIsAdmin = adminIds.includes(p._id)
                // Admins can remove non-admin members; nobody removes themselves here
                const canRemove = isAdmin && !isSelf && !pIsAdmin
                return (
                  <div
                    key={p._id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-900 transition-colors"
                  >
                    <Avatar src={p.avatar} name={p.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">
                        {p.displayName}
                        {isSelf && <span className="text-gray-500 font-normal"> (you)</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate">@{p.username}</p>
                    </div>
                    {pIsAdmin && (
                      <span className="text-[10px] uppercase tracking-wide text-blue-400 font-semibold">
                        admin
                      </span>
                    )}
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(p._id)}
                        disabled={removingId !== null}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5"
                        title={`Remove ${p.displayName}`}
                      >
                        {removingId === p._id ? (
                          <FaSpinner className="animate-spin" size={13} />
                        ) : (
                          <FaUserMinus size={13} />
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leave group */}
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full flex items-center justify-center gap-2 border border-red-900 text-red-400 hover:bg-red-950/40 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {leaving ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaSignOutAlt />
            )}
            Leave group
          </button>
        </div>
      </div>
    </div>
  )
}
