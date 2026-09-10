import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { FaUserPlus, FaEnvelope, FaUserCheck, FaTimes } from 'react-icons/fa'

interface ConnectionUser {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

interface ConnectionEntry {
  _id: string
  user: ConnectionUser
  connectedAt: string
}

interface ConnectionRequest {
  _id: string
  requester: ConnectionUser
  createdAt: string
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionEntry[]>([])
  const [requests, setRequests] = useState<ConnectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.get('/connections')
      setConnections(res.data.connections)
      setRequests(res.data.requests)
    } catch (error) {
      console.error('Failed to fetch connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleAccept = async (userId: string) => {
    try {
      await api.post(`/connections/${userId}/accept`)
      // Move the request into the connections list
      const req = requests.find((r) => r.requester._id === userId)
      if (req) {
        setRequests(requests.filter((r) => r.requester._id !== userId))
        setConnections([
          {
            _id: req._id,
            user: req.requester,
            connectedAt: new Date().toISOString(),
          },
          ...connections,
        ])
      }
    } catch (error) {
      console.error('Failed to accept connection')
    }
  }

  const handleDecline = async (userId: string) => {
    try {
      await api.post(`/connections/${userId}/decline`)
      setRequests(requests.filter((r) => r.requester._id !== userId))
    } catch (error) {
      console.error('Failed to decline connection')
    }
  }

  const handleDisconnect = async (userId: string) => {
    try {
      await api.delete(`/connections/${userId}`)
      setConnections(connections.filter((c) => c.user._id !== userId))
    } catch (error) {
      console.error('Failed to disconnect')
    }
  }

  const handleMessage = async (userId: string) => {
    try {
      const res = await api.post(`/messages/conversation/${userId}`)
      // The participant for the chat header is the user we're messaging (userId),
      // not the other conversation member (which is me)
      const participant = res.data.conversation.participants.find(
        (p: ConnectionUser) => p._id === userId
      )
      if (!participant) throw new Error('Participant not found in conversation')
      navigate('/messages', {
        state: {
          startConversation: {
            conversationId: res.data.conversation._id,
            participant,
          },
        },
      })
    } catch (error) {
      console.error('Failed to start conversation')
    }
  }

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold text-white">Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect with people to start conversations
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div>
          {/* Incoming requests */}
          {requests.length > 0 && (
            <div className="border-b border-gray-800">
              <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-400 uppercase tracking-wide">
                Requests ({requests.length})
              </h2>
              {requests.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center gap-3 p-4 border-b border-gray-800 hover:bg-gray-950 transition-colors"
                >
                  <Link to={`/profile/${req.requester._id}`}>
                    <Avatar src={req.requester.avatar} name={req.requester.displayName} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/profile/${req.requester._id}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {req.requester.displayName}
                    </Link>
                    <p className="text-sm text-gray-500">@{req.requester.username}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Sent {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(req.requester._id)}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <FaUserCheck size={13} /> Accept
                    </button>
                    <button
                      onClick={() => handleDecline(req.requester._id)}
                      className="btn-secondary text-sm flex items-center gap-1.5"
                      title="Decline"
                    >
                      <FaTimes size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Established connections */}
          <div>
            <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Connected ({connections.length})
            </h2>
            {connections.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FaUserPlus className="mx-auto text-3xl mb-3 text-gray-600" />
                <p className="text-lg font-medium">No connections yet</p>
                <p className="mt-1">
                  Visit someone's{' '}
                  <Link to="/explore" className="text-blue-500 hover:underline">
                    Explore
                  </Link>{' '}
                  page and hit Connect to start chatting.
                </p>
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn._id}
                  className="flex items-center gap-3 p-4 border-b border-gray-800 hover:bg-gray-950 transition-colors"
                >
                  <Link to={`/profile/${conn.user._id}`}>
                    <Avatar src={conn.user.avatar} name={conn.user.displayName} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/profile/${conn.user._id}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {conn.user.displayName}
                    </Link>
                    <p className="text-sm text-gray-500">@{conn.user.username}</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Connected{' '}
                      {formatDistanceToNow(new Date(conn.connectedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMessage(conn.user._id)}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <FaEnvelope size={13} /> Message
                    </button>
                    <button
                      onClick={() => handleDisconnect(conn.user._id)}
                      className="btn-secondary text-sm"
                      title="Disconnect"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
