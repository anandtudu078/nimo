import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { verifyToken } from './jwt'
import User from '../models/User'
import { Conversation } from '../models/Message'

interface AuthenticatedSocket extends Socket {
  userId?: string
}

export function setupSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
          .split(',')
          .map((o: string) => o.trim().replace(/\/$/, ''))

        // Allow Vercel preview deployments (strict pattern, must match app.ts:
        // hostnames like nimo-*.vercel.app — not any *.vercel.app containing "nimo")
        const vercelPreviewOk = (() => {
          try {
            if (!origin) return false
            const url = new URL(origin)
            return url.hostname.endsWith('.vercel.app') && url.hostname.startsWith('nimo-')
          } catch {
            return false
          }
        })()
        if (!origin || allowedOrigins.includes(origin) || vercelPreviewOk) {
          callback(null, true)
        } else {
          callback(new Error('Socket.IO CORS not allowed'))
        }
      },
      credentials: true,
    },
  })

  // Auth middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return next(new Error('Authentication required'))
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return next(new Error('Invalid token'))
    }

    // Enforce token versioning so password changes/reset also drop
    // realtime connections, not just REST requests.
    try {
      const user = await User.findById(decoded.userId).select('tokenVersion')
      if (!user || (decoded.ver ?? 0) !== (user as any).tokenVersion) {
        return next(new Error('Session expired'))
      }
    } catch {
      return next(new Error('Authentication failed'))
    }

    socket.userId = decoded.userId
    next()
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!
    console.log(`[Socket] User connected: ${userId}`)

    // Join user's personal room for targeted events
    socket.join(`user:${userId}`)

    // Join a conversation room — only participants may join, so outsiders
    // can't lurk on typing indicators (or spoof them) in private chats.
    socket.on('join_conversation', async (conversationId: string) => {
      try {
        const conversation = await Conversation.findById(conversationId).select('participants')
        const isParticipant = !!conversation && conversation.participants.some(
          (p: any) => p.toString() === userId
        )
        if (isParticipant) {
          socket.join(`conversation:${conversationId}`)
        }
      } catch {
        // Bad id or DB hiccup — don't crash the socket; just don't join.
      }
    })

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
    })

    // Messages are persisted via POST /api/messages and broadcast from
    // routes/messages.ts (single source of truth for storage + real-time).
    // The socket only relays presence/typing events below.

    // Handle typing indicator
    socket.on('typing_start', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        userId,
        conversationId: data.conversationId,
      })
    })

    socket.on('typing_stop', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing_stop', {
        userId,
        conversationId: data.conversationId,
      })
    })

    // Handle online status
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`)
      io.emit('user_offline', { userId })
    })
  })

  return io
}

// Helper to emit to a specific user
export function emitToUser(io: Server, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data)
}
