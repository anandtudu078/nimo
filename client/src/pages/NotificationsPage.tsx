import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import LoadingSpinner from '../components/LoadingSpinner'
import Avatar from '../components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { FaHeart, FaComment, FaUserPlus, FaAt, FaCheckDouble } from 'react-icons/fa'

interface Notification {
  _id: string
  type: 'like' | 'comment' | 'follow' | 'mention'
  from: { _id: string; username: string; displayName: string; avatar?: string }
  post?: { _id: string; content: string }
  createdAt: string
  read: boolean
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'mentions'>('all')

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.notifications)
    } catch (error) {
      console.error('Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications(notifications.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark all as read')
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(notifications.map(n =>
        n._id === id ? { ...n, read: true } : n
      ))
    } catch (error) {
      console.error('Failed to mark notification as read')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <FaHeart className="text-red-500" />
      case 'comment': return <FaComment className="text-blue-500" />
      case 'follow': return <FaUserPlus className="text-green-500" />
      case 'mention': return <FaAt className="text-purple-500" />
      default: return null
    }
  }

  const getMessage = (notification: Notification) => {
    switch (notification.type) {
      case 'like': return 'liked your post'
      case 'comment': return 'commented on your post'
      case 'follow': return 'started following you'
      case 'mention': return 'mentioned you in a post'
      default: return ''
    }
  }

  const filteredNotifications = filter === 'mentions'
    ? notifications.filter(n => n.type === 'mention')
    : notifications

  return (
    <div>
      <div className="sticky top-0 bg-black/80 backdrop-blur-md z-10 border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold mb-3 text-white">Notifications</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('mentions')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === 'mentions' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Mentions
          </button>
          {notifications.some(n => !n.read) && (
            <button
              onClick={markAllAsRead}
              className="ml-auto px-4 py-1.5 rounded-full text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            >
              <FaCheckDouble size={12} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div>
        {loading ? (
          <LoadingSpinner />
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No notifications yet</p>
            <p className="mt-1">When someone interacts with your posts, you'll see it here</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification._id}
              onClick={() => markAsRead(notification._id)}
              className={`flex items-start gap-3 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-950 transition-colors ${
                !notification.read ? 'bg-blue-950/20' : ''
              }`}
            >
              <div className="mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Avatar src={notification.from.avatar} name={notification.from.displayName} size="sm" />
                  <Link
                    to={`/profile/${notification.from._id}`}
                    className="font-semibold hover:underline text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {notification.from.displayName}
                  </Link>
                  <span className="text-gray-500">{getMessage(notification)}</span>
                </div>
                {notification.post && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.post.content}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
