import express from 'express'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import postRoutes from './routes/posts'
import userRoutes from './routes/users'
import messageRoutes from './routes/messages'
import notificationRoutes from './routes/notifications'
import searchRoutes from './routes/search'
import uploadRoutes from './routes/upload'
import reportRoutes from './routes/reports'
import pushNotificationRoutes from './routes/pushNotifications'
import muteRoutes from './routes/mutes'
import draftRoutes from './routes/drafts'
import emailVerificationRoutes from './routes/emailVerification'
import exploreRoutes from './routes/explore'
import { apiLimiter, authLimiter, postLimiter } from './middleware/rateLimit'

dotenv.config()

const app = express()

// Trust first proxy (Railway, Heroku, etc.) — fixes rate limiter X-Forwarded-For error
app.set('trust proxy', 1)

// Middleware
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o: string) => o.trim().replace(/\/$/, ''))
console.log('[CORS] Allowed origins:', allowedOrigins)

// Check if origin matches any allowed origin or Vercel preview pattern
function isOriginAllowed(origin: string): boolean {
  // Exact match
  if (allowedOrigins.includes(origin)) return true

  // Allow Vercel preview deployments: nimo-*.vercel.app
  try {
    const url = new URL(origin)
    if (url.hostname.endsWith('.vercel.app') && url.hostname.startsWith('nimo-')) {
      return true
    }
  } catch {}

  return false
}

// Custom CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined
  if (!origin || isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }
  } else if (req.method === 'OPTIONS') {
    console.log('[CORS] Blocked origin:', origin)
    return res.sendStatus(403)
  }
  next()
})

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// Routes
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/posts', postLimiter, postRoutes)
app.use('/api/users', apiLimiter, userRoutes)
app.use('/api/messages', apiLimiter, messageRoutes)
app.use('/api/notifications', apiLimiter, notificationRoutes)
app.use('/api/search', apiLimiter, searchRoutes)
app.use('/api/upload', apiLimiter, uploadRoutes)
app.use('/api/reports', apiLimiter, reportRoutes)
app.use('/api/push-notifications', apiLimiter, pushNotificationRoutes)
app.use('/api/mutes', apiLimiter, muteRoutes)
app.use('/api/drafts', apiLimiter, draftRoutes)
app.use('/api/email-verification', apiLimiter, emailVerificationRoutes)
app.use('/api/explore', apiLimiter, exploreRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})


// Global error handler — catches unhandled async errors and multer middleware errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]', err.message || err)
  const statusCode = err.statusCode || err.status || 500
  res.status(statusCode).json({ message: err.message || 'Internal server error' })
})

export default app
