import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../hooks/useSocket'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { FaPaperPlane, FaArrowLeft } from 'react-icons/fa'

interface MessageParticipant {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

interface Conversation {
  _id: string
  participant: MessageParticipant
  lastMessage?: { content: string; createdAt: string }
  unreadCount: number
}

interface Message {
  _id: string
  sender: string | MessageParticipant
  content: string
  createdAt: string
  read?: boolean
  delivered?: boolean
}

// Server populates `sender` as a user object; socket payloads send the plain id
function getSenderId(sender: Message['sender']): string {
  return typeof sender === 'string' ? sender : sender?._id
}

// Legacy/malformed records can lack a valid timestamp (e.g. lastMessage
// without createdAt). date-fns throws RangeError on invalid dates and would
// crash the whole page, so fall back to an empty string instead.
function formatMessageTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export default function MessagesPage() {
  const { user } = useAuth()
  const {
    connected,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    onNewMessage,
    onNewMessageNotification,
    onMessagesDelivered,
    onMessagesRead,
    onUserTyping,
    onUserTypingStop,
  } = useSocket()
  const location = useLocation()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingConversationRef = useRef<{ conversationId: string; participant: MessageParticipant } | null>(null)

  useEffect(() => {
    // If we were navigated here to start a conversation (Message button on a profile)
    const state = location.state as { startConversation?: { conversationId: string; participant: MessageParticipant } } | null
    if (state?.startConversation) {
      pendingConversationRef.current = state.startConversation
      // Clear the navigation state so a refresh doesn't reopen the chat
      navigate(location.pathname, { replace: true })
    }
    fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id)
      joinConversation(selectedConversation._id)
    }
    return () => {
      if (selectedConversation) {
        leaveConversation(selectedConversation._id)
      }
    }
  }, [selectedConversation])

  // Listen for real-time messages
  useEffect(() => {
    const cleanup = onNewMessage((data: any) => {
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        const incoming = data.message || data
        const incomingSenderId = getSenderId(incoming.sender)
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m._id === incoming._id)) return prev
          return [...prev, {
            _id: incoming._id || `temp-${Date.now()}`,
            sender: incoming.sender,
            content: incoming.content,
            createdAt: incoming.createdAt,
            read: false,
            delivered: false,
          }]
        })
        // We are viewing the chat, so acknowledge their message right away
        if (incomingSenderId && incomingSenderId !== user?._id) {
          const conversationId = selectedConversation._id
          api.put(`/messages/${conversationId}/delivered`).catch(() => {})
          api.put(`/messages/${conversationId}/read`).catch(() => {})
        }
      }
    })
    return cleanup
  }, [selectedConversation, onNewMessage, user?._id])

  // Listen for new message notifications (to update conversation list)
  useEffect(() => {
    const cleanup = onNewMessageNotification((data: any) => {
      setConversations((prev) => {
        const target = prev.find((c) => c._id === data.conversationId)
        if (!target) {
          // Brand-new conversation — refresh so it appears in the list
          fetchConversations()
          return prev
        }
        return prev.map((c) =>
          c._id === data.conversationId
            ? {
                ...c,
                lastMessage: data.message
                  ? { content: data.message.content, createdAt: data.message.createdAt }
                  : c.lastMessage,
                unreadCount: c._id === selectedConversation?._id ? 0 : c.unreadCount + 1,
              }
            : c
        )
      })
    })
    return cleanup
  }, [selectedConversation, onNewMessageNotification])

  // Listen for typing indicators
  useEffect(() => {
    const cleanup1 = onUserTyping((data: any) => {
      if (data.conversationId === selectedConversation?._id && data.userId !== user?._id) {
        setTypingUsers((prev) => new Set(prev).add(data.userId))
      }
    })
    const cleanup2 = onUserTypingStop((data: any) => {
      setTypingUsers((prev) => {
        const next = new Set(prev)
        next.delete(data.userId)
        return next
      })
    })
    return () => { cleanup1(); cleanup2() }
  }, [selectedConversation, onUserTyping, onUserTypingStop, user?._id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations')
      setConversations(res.data.conversations)

      // Auto-open a conversation we were navigated to from a profile
      const pending = pendingConversationRef.current
      if (pending) {
        pendingConversationRef.current = null
        const existing = res.data.conversations.find((c: Conversation) => c._id === pending.conversationId)
        if (existing) {
          setSelectedConversation(existing)
        } else {
          setSelectedConversation({
            _id: pending.conversationId,
            participant: pending.participant,
            unreadCount: 0,
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversations')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await api.get(`/messages/${conversationId}`)
      setMessages(res.data.messages)
      // The chat is open, so acknowledge the other user's messages (delivered -> read)
      await Promise.allSettled([
        api.put(`/messages/${conversationId}/delivered`),
        api.put(`/messages/${conversationId}/read`),
      ])
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
      )
    } catch (error) {
      console.error('Failed to fetch messages')
    }
  }

  // Pull the read/delivered state of our own sent messages so ✓ / ✓✓ stay accurate
  const syncReceipts = useCallback(async (conversationId: string) => {
    try {
      const res = await api.get(`/messages/${conversationId}/status`)
      const statusMap = new Map<string, { delivered: boolean; read: boolean }>(
        res.data.status.map((s: any) => [s.messageId, { delivered: !!s.delivered, read: !!s.read }])
      )
      setMessages((prev) =>
        prev.map((m) => {
          const status = statusMap.get(m._id)
          return status ? { ...m, delivered: status.delivered, read: status.read } : m
        })
      )
    } catch (error) {
      // Receipt sync is best-effort
    }
  }, [])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      // POST /messages persists the message and broadcasts it to the other
      // participant over the socket, so we only append the API response here.
      const res = await api.post('/messages', {
        conversationId: selectedConversation._id,
        content,
      })
      setMessages((prev) => [...prev, res.data.message])
    } catch (error) {
      console.error('Failed to send message')
      setNewMessage(content) // Restore on failure
    } finally {
      setSending(false)
    }
  }

  const handleTyping = useCallback(() => {
    if (!selectedConversation) return
    startTyping(selectedConversation._id)

    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(selectedConversation._id)
    }, 2000)
  }, [selectedConversation, startTyping, stopTyping])

  // Listen for read/delivered receipts so our sent messages show ✓ / ✓✓
  useEffect(() => {
    const handleReceipt = (data: any) => {
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        syncReceipts(selectedConversation._id)
      }
    }
    const cleanupDelivered = onMessagesDelivered(handleReceipt)
    const cleanupRead = onMessagesRead(handleReceipt)
    return () => { cleanupDelivered(); cleanupRead() }
  }, [selectedConversation, onMessagesDelivered, onMessagesRead, syncReceipts])

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:block' : ''} w-full md:w-80 border-r border-gray-800 overflow-y-auto`}>
        <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Messages</h1>
            {connected && <span className="w-2 h-2 bg-green-500 rounded-full" title="Connected" />}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No conversations yet</p>
            <p className="text-sm mt-1">Start a conversation from a user's profile</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv._id}
              onClick={() => setSelectedConversation(conv)}
              className={`w-full flex items-center gap-3 p-4 hover:bg-gray-900 transition-colors border-b border-gray-800 ${
                selectedConversation?._id === conv._id ? 'bg-gray-900' : ''
              }`}
            >
              <Avatar src={conv.participant?.avatar} name={conv.participant?.displayName || 'Unknown'} />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <p className="font-semibold truncate text-white">{conv.participant?.displayName || 'Unknown'}</p>
                  {conv.lastMessage && (
                    <span className="text-xs text-gray-500">
                      {formatMessageTime(conv.lastMessage?.createdAt)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-sm text-gray-500 truncate">{conv.lastMessage.content}</p>
                )}
              </div>
              {conv.unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Chat View */}
      <div className={`${selectedConversation ? '' : 'hidden md:flex'} flex-1 flex flex-col bg-black`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-black border-b border-gray-800 p-4 flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden text-gray-400 hover:text-white"
              >
                <FaArrowLeft size={20} />
              </button>
              <Avatar src={selectedConversation.participant?.avatar} name={selectedConversation.participant?.displayName || 'Unknown'} />
              <div>
                <p className="font-semibold text-white">{selectedConversation.participant.displayName}</p>
                <p className="text-sm text-gray-500">
                  {typingUsers.size > 0 ? (
                    <span className="text-blue-400">typing...</span>
                  ) : (
                    `@${selectedConversation.participant?.username || ''}`
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const isOwn = getSenderId(msg.sender) === user?._id
                return (
                  <div key={msg._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-white border border-gray-700'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div
                        className={`flex items-center justify-end gap-1.5 mt-1 text-xs ${
                          isOwn ? 'text-blue-200' : 'text-gray-500'
                        }`}
                      >
                        <span>
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          <span
                            className="font-semibold"
                            title={msg.read ? 'Read' : msg.delivered ? 'Delivered' : 'Sent'}
                          >
                            {msg.read ? '✓✓' : msg.delivered ? '✓' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="bg-black border-t border-gray-800 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  placeholder="Type a message..."
                  className="input-field flex-1"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="btn-primary px-4"
                >
                  <FaPaperPlane size={18} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="mt-1">Choose from your existing conversations or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
