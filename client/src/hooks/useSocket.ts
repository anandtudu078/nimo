import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setConnected(true)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
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
    socketRef.current?.on('new_message', callback)
    return () => { socketRef.current?.off('new_message', callback) }
  }, [])

  const onNewMessageNotification = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('new_message_notification', callback)
    return () => { socketRef.current?.off('new_message_notification', callback) }
  }, [])

  const onMessagesDelivered = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('messages_delivered', callback)
    return () => { socketRef.current?.off('messages_delivered', callback) }
  }, [])

  const onMessagesRead = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('messages_read', callback)
    return () => { socketRef.current?.off('messages_read', callback) }
  }, [])

  const onUserTyping = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('user_typing', callback)
    return () => { socketRef.current?.off('user_typing', callback) }
  }, [])

  const onUserTypingStop = useCallback((callback: (data: any) => void) => {
    socketRef.current?.on('user_typing_stop', callback)
    return () => { socketRef.current?.off('user_typing_stop', callback) }
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
