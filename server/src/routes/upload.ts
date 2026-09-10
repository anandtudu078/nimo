import { Router, Response } from 'express'
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary'
import { auth, AuthRequest } from '../middleware/auth'
import Post from '../models/Post'
import User from '../models/User'

const router = Router()

// Wrap multer middleware to catch promise rejections (multer v2 is async)
const handleImageUpload = async (req: AuthRequest, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    upload.array('images', 4)(req as any, res as any, (err: any) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

// Upload images (up to 4, carousel support)
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    await handleImageUpload(req, res)

    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' })
    }

    if (files.length > 4) {
      return res.status(400).json({ message: 'Maximum 4 images allowed per post' })
    }

    const urls = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, file.originalname))
    )

    // Build image metadata with order and optional alt text
    const alts = req.body.alts ? JSON.parse(req.body.alts) : []
    const imageMeta = urls.map((url, i) => ({
      url,
      alt: alts[i] || '',
      order: i,
    }))

    res.json({ urls, imageMeta })
  } catch (error: any) {
    console.error('[Upload] Error:', error.message || error)
    const statusCode = error.code && error.code.startsWith('LIMIT_') ? 400 : 500
    res.status(statusCode).json({ message: error.message || 'Failed to upload images' })
  }
})

// Delete an image from Cloudinary (only if the caller owns it)
router.delete('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'No URL provided' })
    }

    // Ownership check: the URL must be attached to one of the caller's posts
    // or their profile. Without this, any user could destroy any image in the
    // Cloudinary account by URL.
    const [ownedPost, ownedProfile] = await Promise.all([
      Post.findOne({ author: req.userId, $or: [{ images: url }, { 'imageMeta.url': url }] }).select('_id'),
      User.findOne({ _id: req.userId, $or: [{ avatar: url }, { profileBanner: url }] }).select('_id'),
    ])

    if (!ownedPost && !ownedProfile) {
      return res.status(403).json({ message: 'You can only delete images you own' })
    }

    await deleteFromCloudinary(url)
    res.json({ message: 'Image deleted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete image' })
  }
})

export default router
