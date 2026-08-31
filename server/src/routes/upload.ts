import { Router, Response } from 'express'
import { upload, uploadToCloudinary } from '../config/cloudinary'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Upload images (up to 4)
router.post('/', auth, upload.array('images', 4), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' })
    }

    // Upload each file buffer to Cloudinary
    const urls = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, file.originalname))
    )

    res.json({ urls })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to upload images' })
  }
})

// Delete an image from Cloudinary
router.delete('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body
    if (!url) {
      return res.status(400).json({ message: 'No URL provided' })
    }

    // Extract public_id from Cloudinary URL
    const parts = url.split('/')
    const folderAndFile = parts.slice(parts.indexOf('nimo')).join('/')
    const publicId = folderAndFile.replace(/\.[^.]+$/, '')

    const { v2: cloudinary } = await import('cloudinary')
    await cloudinary.uploader.destroy(publicId)

    res.json({ message: 'Image deleted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete image' })
  }
})

export default router
