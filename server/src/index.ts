import mongoose from 'mongoose'
import { createServer } from 'http'
import app from './app'
import { setupSocketIO } from './config/socket'

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nimo'

async function startServer(retries = 3) {
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

      // Create HTTP server and attach Socket.io
      const httpServer = createServer(app)
      const io = setupSocketIO(httpServer)
      app.set('io', io) // Make io accessible in routes

      httpServer.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`)
        console.log(`🔌 Socket.io ready`)
      })
      return // success, exit the function
    } catch (error: any) {
      console.error(`❌ MongoDB connection error (attempt ${attempt}/${retries}):`, error.message)
      if (attempt === retries) {
        console.error('💡 Make sure your IP is whitelisted in MongoDB Atlas Network Access')
        process.exit(1)
      }
      // Wait before retrying
      console.log(`⏳ Retrying in 5 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

startServer()
