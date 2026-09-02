import multer from 'multer'
import { Request } from 'express'

// Keep a clean cache for the configured instance
let _cloudinary: any = null

function getCloudinary(): any {
  // 1. If we already successfully connected, return it immediately
  if (_cloudinary) return _cloudinary

  // 2. Read the absolute freshest values directly from process.env at runtime
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  // 3. Check variables cleanly on every invocation if not cached yet
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName && 'CLOUDINARY_CLOUD_NAME',
      !apiKey && 'CLOUDINARY_API_KEY',
      !apiSecret && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean)
    
    console.error('[Cloudinary] Missing configuration items:', missing.join(', '))
    throw new Error(`Missing Cloudinary env vars: ${missing.join(', ')}`)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('cloudinary')
    const c = mod.v2 || mod
    
    c.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    })

    _cloudinary = c // Cache success
    console.log('[Cloudinary] ✅ Successfully configured at runtime')
    return _cloudinary
  } catch (err: any) {
    console.error('[Cloudinary] Configuration initialization failed:', err.message)
    throw new Error('Image upload utility is temporarily unavailable')
  }
}

// Use memory storage
const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 4,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'))
    }
  },
})

export function uploadToCloudinary(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // Pulls configuration dynamically
  const cloudinary = getCloudinary()
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'nimo',
        public_id: `${Date.now()}-${filename.replace(/[^a-zA-Z0-9]/g, '')}`,
        transformation: [
          { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
        ],
      },
      (error: any, result: any) => {
        if (error) {
          console.error('[Cloudinary] Upload stream failed:', error.message || error)
          reject(error)
        } else {
          resolve(result!.secure_url)
        }
      }
    )
    stream.end(buffer)
  })
}

export function deleteFromCloudinary(url: string): Promise<void> {
  try {
    const cloudinary = getCloudinary()
    const parts = url.split('/')
    const nimoIndex = parts.indexOf('nimo')
    
    if (nimoIndex === -1) {
      throw new Error("Target delivery directory 'nimo' not detected in URL structure")
    }
    
    const folderAndFile = parts.slice(nimoIndex).join('/')
    const publicId = folderAndFile.replace(/\.[^.]+$/, '') // Drops file extensions safely
    
    return cloudinary.uploader.destroy(publicId)
  } catch (err: any) {
    console.error('[Cloudinary] Asset deletion failed:', err.message)
    return Promise.reject(err)
  }
}
