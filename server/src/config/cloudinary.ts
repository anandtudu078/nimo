import multer from 'multer'
import { Request } from 'express'

// Lazy-load cloudinary — use require() with try/catch for max safety
let _cloudinary: any = null
let _loadError: string | null = null

function getCloudinary(): any {
  if (_loadError) throw new Error(_loadError)
  if (_cloudinary) return _cloudinary

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
    return _cloudinary
  } catch (err: any) {
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
        if (error) reject(error)
        else resolve(result!.secure_url)
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
