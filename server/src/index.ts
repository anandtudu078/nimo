import mongoose from 'mongoose'
import app from './app'

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
      // Enable TLS for remote MongoDB Atlas connections
      if (MONGODB_URI.includes('mongodb+srv://') || MONGODB_URI.includes('atlas')) {
        options.tls = true
      }
      await mongoose.connect(MONGODB_URI, options)
      console.log('✅ Connected to MongoDB')
      app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`)
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
