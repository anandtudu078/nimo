import mongoose from 'mongoose'
import app from './app'

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nimo'

async function startServer() {
  try {
    console.log('📦 Connecting to MongoDB...')
    const options: any = {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    }
    // For mongodb+srv URIs, Node.js DNS SRV may fail — fallback to direct URI
    if (!MONGODB_URI.startsWith('mongodb+srv://')) {
      options.tls = true
      options.tlsAllowInvalidHostnames = true
    }
    await mongoose.connect(MONGODB_URI, options)
    console.log('✅ Connected to MongoDB')
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    })
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message)
    console.error('💡 Make sure your IP is whitelisted in MongoDB Atlas Network Access')
    process.exit(1)
  }
}

startServer()
