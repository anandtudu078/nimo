import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import User from '../models/User'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { Message } from '../models/Message'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Multer config for avatar uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/
    const ext = allowed.test(path.extname(file.originalname).toLowerCase())
    const mime = allowed.test(file.mimetype)
    cb(null, ext && mime)
  },
})

// Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' })
    }

    const avatarUrl = `/uploads/${req.file.filename}`
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ user, avatarUrl })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to upload avatar' })
  }
})

// Update profile
router.put('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bio, website, avatar } = req.body
    const user = await User.findByIdAndUpdate(
      req.userId,
      { displayName, bio, website, avatar },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update profile' })
  }
})

// Follow/unfollow user
router.post('/:userId/follow', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId === req.params.userId) {
      return res.status(400).json({ message: 'Cannot follow yourself' })
    }

    const userToFollow = await User.findById(req.params.userId)
    const currentUser = await User.findById(req.userId)

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const isFollowing = currentUser.following.includes(userToFollow._id)

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== userToFollow._id.toString()
      )
      userToFollow.followers = userToFollow.followers.filter(
        (id) => id.toString() !== currentUser._id.toString()
      )
    } else {
      // Follow
      currentUser.following.push(userToFollow._id as any)
      userToFollow.followers.push(currentUser._id as any)

      // Create notification
      await Notification.create({
        user: userToFollow._id,
        from: currentUser._id,
        type: 'follow',
      })
    }

    await currentUser.save()
    await userToFollow.save()

    res.json({ following: !isFollowing })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to follow user' })
  }
})

// Get user's followers
router.get('/:userId/followers', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).populate('followers', 'username displayName avatar')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ followers: user.followers })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get followers' })
  }
})

// Get user's following
router.get('/:userId/following', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).populate('following', 'username displayName avatar')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ following: user.following })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get following' })
  }
})

// Get user profile
router.get('/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get user' })
  }
})

// Delete account
router.delete('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId

    // Delete all user's posts
    await Post.deleteMany({ author: userId })

    // Remove user from all followers/following lists
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    )
    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    )

    // Delete all notifications for/from this user
    await Notification.deleteMany({ $or: [{ user: userId }, { from: userId }] })

    // Delete all messages in conversations involving this user
    await Message.deleteMany({ sender: userId })

    // Delete the user itself
    await User.findByIdAndDelete(userId)

    res.json({ message: 'Account deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete account' })
  }
})

export default router
