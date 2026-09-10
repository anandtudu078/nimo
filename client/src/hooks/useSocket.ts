import { useEffect, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'

// Socket server URL: derive from VITE_API_URL (/api → server root), else same origin.
// Never fall back to localhost — that breaks every deployed environment.
const SOCKET_URL = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || window.location.origin

// Singleton: several hooks/components call useSocket() per page (Layout,
// MessagesPage, useUnreadCounts...). Without this, every caller opened its own
// socket connection, multiplying server connections and duplicating events.
let sharedSocket: Socket | null = null

function getSharedSocket(): Socket | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return sharedSocket
}

// Drop the shared socket (e.g. on logout) so a new login creates a fresh
// connection with the new token instead of reusing the previous user's socket.
export function resetSharedSocket() {
  if (sharedSocket) {
    sharedSocket.disconnect()
    sharedSocket = null
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = getSharedSocket()
    if (!socket) return

    socketRef.current = socket

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    // Sync with the real state — the socket may already be connected when a
    // second component mounts (e.g. navigating straight to /messages)
    if (socket.connected) setConnected(true)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      // Intentionally do NOT disconnect the shared socket here; it lives for
      // the whole tab session and other components may still be using it.
    }
  }, [])

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conversation', conversationId)
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave_conversation', conversationId)
  }, [])

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_start', { conversationId })
  }, [])

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_stop', { conversationId })
  }, [])

  const onNewMessage = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('new_message', callback)
    return () => { socket.off('new_message', callback) }
  }, [])

  const onNewMessageNotification = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('new_message_notification', callback)
    return () => { socket.off('new_message_notification', callback) }
  }, [])

  const onMessagesDelivered = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('messages_delivered', callback)
    return () => { socket.off('messages_delivered', callback) }
  }, [])

  const onMessagesRead = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('messages_read', callback)
    return () => { socket.off('messages_read', callback) }
  }, [])

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('user_typing', callback)
    return () => { socket.off('user_typing', callback) }
  }, [])

  const onUserTypingStop = useCallback((callback: (data: any) => void) => {
    const socket = getSharedSocket()
    if (!socket) return () => {}
    socket.on('user_typing_stop', callback)
    return () => { socket.off('user_typing_stop', callback) }
  }, [])

  return {
    socket: socketRef.current,
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
  }
}
