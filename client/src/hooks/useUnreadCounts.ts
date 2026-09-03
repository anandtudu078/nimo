import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useSocket } from './useSocket'

export function useUnreadCounts() {
  const [messageCount, setMessageCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const { onNewMessageNotification } = useSocket()

  const fetchCounts = useCallback(async () => {
    try {
      const [msgRes, notifRes] = await Promise.all([
        api.get('/messages/unread-count'),
        api.get('/notifications/unread-count'),
      ])
      setMessageCount(msgRes.data.count)
      setNotificationCount(notifRes.data.count)
    } catch (error) {
      // Silently fail — counts are non-critical
    }
  }, [])

  useEffect(() => {
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000) // Poll every 30s as a fallback
    return () => clearInterval(interval)
  }, [fetchCounts])

  // Refresh promptly when a new message arrives, so the badge doesn't wait for the poll
  useEffect(() => {
    const cleanup = onNewMessageNotification(() => {
      fetchCounts()
    })
    return cleanup
  }, [onNewMessageNotification, fetchCounts])

  return { messageCount, notificationCount, refetch: fetchCounts }
}
