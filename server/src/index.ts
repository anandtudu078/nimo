import mongoose from 'mongoose'
import { createServer } from 'http'
import app from './app'
import { setupSocketIO } from './config/socket'
import { initCache } from './config/redis'
import { startScheduler } from './config/scheduler'

// Boot marker: printed on every start so deployed logs unambiguously show
// which build is actually running (guards against stale build-cache deploys).
const BOOT_VERSION = '2026-09-07-cache-bust-1'
console.log(`🏷️  [boot] nimo-server ${BOOT_VERSION} (node ${process.version})`)

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nimo'

// Last-resort guards: a stray async rejection or programmer error must not
// silently kill the process mid-deploy. Railway's ON_FAILURE restart policy
// covers truly fatal states; these just stop the common leak-by-throw cases.
process.on('unhandledRejection', (reason: any) => {
  console.error('[Process] Unhandled rejection:', reason?.message || reason)
})
process.on('uncaughtException', (error: any) => {
  console.error('[Process] Uncaught exception:', error?.message || error)
})

async function connectMongo(retries = 30): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📦 Connecting to MongoDB... (attempt ${attempt}/${retries})`)
      const options: any = {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
      }
      // mongodb+srv:// always requires TLS
      if (MONGODB_URI.includes('mongodb+srv://')) {
        options.tls = true
      }
      console.log(`🔌 Connecting to: ${MONGODB_URI.replace(/:\/\/[^:]+:[^@]+@/, ':***@')}`)
      await mongoose.connect(MONGODB_URI, options)
      console.log('✅ Connected to MongoDB')
      return
    } catch (error: any) {
      console.error(`❌ MongoDB connection error (attempt ${attempt}/${retries}):`, error.message)
      if (attempt === retries) {
        console.error('💡 Make sure your IP is whitelisted in MongoDB Atlas Network Access')
        // Keep the HTTP server alive — /api/health keeps answering and the
        // connection retries continue, so a Mongo blip doesn't fail the
        // whole deployment.
        return
      }
      console.log('⏳ Retrying in 5 seconds...')
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

async function startServer() {
  // Bind the port FIRST. Deploy platforms (Railway, Heroku, Fly…) consider a
  // deploy healthy only once the app listens — waiting for MongoDB before
  // listening made every cold start race the healthcheck and fail deploys
  // whenever Mongo was slow to accept connections. API routes that need the
  // DB simply return errors until the background connect succeeds.
  const httpServer = createServer(app)
  const io = setupSocketIO(httpServer)
  app.set('io', io) // Make io accessible in routes

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log(`🔌 Socket.io ready`)
  })

  // Cache and database come up in the background
  await initCache()
  await connectMongo()

  // Publish scheduled drafts once the DB is reachable
  startScheduler()
}

startServer()
