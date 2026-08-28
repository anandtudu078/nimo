import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { FaPaperPlane, FaArrowLeft } from 'react-icons/fa'

interface Conversation {
  _id: string
  participant: { _id: string; username: string; displayName: string; avatar?: string }
  lastMessage: { content: string; createdAt: string }
  unreadCount: number
}

interface Message {
  _id: string
  sender: string
  content: string
  createdAt: string
}

export default function MessagesPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation._id)
    }
  }, [selectedConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    try {
      const res = await api.get('/messages/conversations')
      setConversations(res.data.conversations)
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
      // Mark as read
      await api.put(`/messages/${conversationId}/read`)
      setConversations(conversations.map(c =>
        c._id === conversationId ? { ...c, unreadCount: 0 } : c
      ))
    } catch (error) {
      console.error('Failed to fetch messages')
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return
    setSending(true)
    try {
      const res = await api.post('/messages', {
        conversationId: selectedConversation._id,
        content: newMessage,
      })
      setMessages([...messages, res.data.message])
      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Conversations List */}
      <div className={`${selectedConversation ? 'hidden md:block' : ''} w-full md:w-80 border-r border-gray-200 overflow-y-auto`}>
        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-200 p-4">
          <h1 className="text-xl font-bold">Messages</h1>
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
              className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                selectedConversation?._id === conv._id ? 'bg-blue-50' : ''
              }`}
            >
              <Avatar src={conv.participant.avatar} name={conv.participant.displayName} />
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <p className="font-semibold truncate">{conv.participant.displayName}</p>
                  {conv.lastMessage && (
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
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
      <div className={`${selectedConversation ? '' : 'hidden md:flex'} flex-1 flex flex-col bg-gray-50`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden text-gray-600 hover:text-gray-800"
              >
                <FaArrowLeft size={20} />
              </button>
              <Avatar src={selectedConversation.participant.avatar} name={selectedConversation.participant.displayName} />
              <div>
                <p className="font-semibold">{selectedConversation.participant.displayName}</p>
                <p className="text-sm text-gray-500">@{selectedConversation.participant.username}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.sender === user?._id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-2xl ${
                      msg.sender === user?._id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.sender === user?._id ? 'text-blue-100' : 'text-gray-400'}`}>
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
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
