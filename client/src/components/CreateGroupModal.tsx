import { useEffect, useState } from 'react'
import { FaTimes, FaUsers, FaSpinner, FaCheck } from 'react-icons/fa'
import api from '../services/api'
import Avatar from './Avatar'
import { getErrorMessage } from '../utils/errors'

interface ConnectionUser {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

interface CreateGroupModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateGroupModal({ onClose, onSuccess }: CreateGroupModalProps) {
  const [name, setName] = useState('')
  const [connections, setConnections] = useState<ConnectionUser[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await api.get('/connections')
        setConnections(res.data.connections.map((c: any) => c.user))
      } catch (err: any) {
        setError(getErrorMessage(err, "Couldn't load your connections"))
      } finally {
        setLoading(false)
      }
    }
    fetchConnections()
  }, [])

  const toggleMember = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || selected.size < 2) return

    setCreating(true)
    setError('')
    try {
      await api.post('/messages/groups', {
        name: name.trim(),
        memberIds: [...selected],
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create group'))
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-black border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 font-bold text-white text-base">
            <FaUsers className="text-blue-400" />
            <span>New group</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4">
          {error && (
            <div className="mb-3 p-2.5 bg-red-950/50 border border-red-900 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Group name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={50}
            className="input-field w-full mb-4"
            autoFocus
          />

          {/* Member picker */}
          <p className="text-sm text-gray-500 mb-2">
            Add members <span className="text-gray-600">(pick at least 2)</span>
          </p>
          <div className="max-h-64 overflow-y-auto border border-gray-800 rounded-xl divide-y divide-gray-800/60">
            {loading ? (
              <div className="p-4 flex justify-center">
                <FaSpinner className="animate-spin text-gray-500" />
              </div>
            ) : connections.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">
                Connect with people first to add them to a group
              </p>
            ) : (
              connections.map((u) => {
                const isSelected = selected.has(u._id)
                return (
                  <button
                    type="button"
                    key={u._id}
                    onClick={() => toggleMember(u._id)}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-900 transition-colors ${
                      isSelected ? 'bg-gray-900' : ''
                    }`}
                  >
                    <Avatar src={u.avatar} name={u.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-white">{u.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">@{u.username}</p>
                    </div>
                    {isSelected && <FaCheck className="text-blue-400 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>

          <button
            type="submit"
            disabled={creating || !name.trim() || selected.size < 2}
            className="btn-primary w-full mt-4 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </div>
    </div>
  )
}
