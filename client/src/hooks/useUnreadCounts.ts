import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

export function useUnreadCounts() {
  const [messageCount, setMessageCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)

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
    const interval = setInterval(fetchCounts, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [fetchCounts])

  return { messageCount, notificationCount, refetch: fetchCounts }
}
