import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

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

        // Allow Vercel preview deployments
        if (!origin || allowedOrigins.includes(origin) ||
          (origin.endsWith('.vercel.app') && origin.includes('nimo'))) {
          callback(null, true)
        } else {
          callback(new Error('Socket.IO CORS not allowed'))
        }
      },
      credentials: true,
    },
  })

  // Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      socket.userId = decoded.userId
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!
    console.log(`[Socket] User connected: ${userId}`)

    // Join user's personal room for targeted events
    socket.join(`user:${userId}`)

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
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
