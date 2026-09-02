import multer from 'multer'
import { Request } from 'express'

// Lazy-load cloudinary — use require() with try/catch for max safety
let _cloudinary: any = null
let _loadError: string | null = null
let _lastEnvCheck: string = ''

function getCloudinary(): any {
  // Build a fingerprint of env var presence so we can detect if vars change
  // (e.g. after a Railway env-var update without full process restart)
  const envFingerprint = [
    !!process.env.CLOUDINARY_CLOUD_NAME,
    !!process.env.CLOUDINARY_API_KEY,
    !!process.env.CLOUDINARY_API_SECRET,
  ].join(',')

  // If env vars changed since last check, reset cached state so we re-evaluate
  if (_loadError && envFingerprint !== _lastEnvCheck) {
    console.log('[Cloudinary] Env vars changed, resetting cached state')
    _loadError = null
    _cloudinary = null
  }

  if (_loadError) throw new Error(_loadError)
  if (_cloudinary) return _cloudinary

  // Check required env vars before attempting upload
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const missing = [
      !process.env.CLOUDINARY_CLOUD_NAME && 'CLOUDINARY_CLOUD_NAME',
      !process.env.CLOUDINARY_API_KEY && 'CLOUDINARY_API_KEY',
      !process.env.CLOUDINARY_API_SECRET && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean)
    _lastEnvCheck = envFingerprint
    _loadError = `Missing Cloudinary env vars: ${missing.join(', ')}`
    console.error('[Cloudinary]', _loadError)
    throw new Error('Missing Cloudinary env vars: ' + missing.join(', '))
  }

  try {
    // Use require() instead of import() to avoid ESM/CJS issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('cloudinary')
    const c = mod.v2 || mod
    c.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    _cloudinary = c
    _lastEnvCheck = envFingerprint
    console.log('[Cloudinary] ✅ Successfully configured')
    return _cloudinary
  } catch (err: any) {
    _lastEnvCheck = envFingerprint
    _loadError = `Cloudinary unavailable: ${err.message}`
    console.error('[Cloudinary]', _loadError)
    throw new Error('Image upload is temporarily unavailable')
  }
}

// Use memory storage
const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
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
          console.error('[Cloudinary] Upload failed:', error.message || error)
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
  const cloudinary = getCloudinary()
  const parts = url.split('/')
  const folderAndFile = parts.slice(parts.indexOf('nimo')).join('/')
  const publicId = folderAndFile.replace(/\.[^.]+$/, '')
  return cloudinary.uploader.destroy(publicId)
}
