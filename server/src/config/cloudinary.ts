import multer from 'multer'
import { Request } from 'express'

// Lazy-load cloudinary to prevent startup crash
let _cloudinary: any = null

async function getCloudinary() {
  if (!_cloudinary) {
    const mod = await import('cloudinary')
    _cloudinary = mod.v2
    _cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
  }
  return _cloudinary
}

// Use memory storage — we upload to Cloudinary via the SDK directly
const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 4, // Max 4 images per post
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

// Upload buffer to Cloudinary
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const cloudinary = await getCloudinary()
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

export async function deleteFromCloudinary(url: string): Promise<void> {
  const cloudinary = await getCloudinary()
  const parts = url.split('/')
  const folderAndFile = parts.slice(parts.indexOf('nimo')).join('/')
  const publicId = folderAndFile.replace(/\.[^.]+$/, '')
  await cloudinary.uploader.destroy(publicId)
}
