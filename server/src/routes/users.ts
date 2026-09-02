import { Router, Response } from 'express'
import User from '../models/User'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { Message } from '../models/Message'
import { auth, AuthRequest } from '../middleware/auth'
import { upload, uploadToCloudinary } from '../config/cloudinary'

const router = Router()

// Upload avatar (via Cloudinary)
router.post('/avatar', auth, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' })
    }

    const avatarUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname)
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
    console.error('[Avatar Upload] Error:', error.message || error)
    res.status(500).json({ message: error.message || 'Failed to upload avatar' })
  }
})

// Update profile
router.put('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bio, website, avatar } = req.body
    const updateData: Record<string, any> = {}
    if (displayName !== undefined) updateData.displayName = displayName
    if (bio !== undefined) updateData.bio = bio
    if (website !== undefined) updateData.website = website
    if (avatar !== undefined) updateData.avatar = avatar
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
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

// Get blocked users (must be before /:userId to avoid route conflict)
router.get('/me/blocked', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).populate('blockedUsers', 'username displayName avatar')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ blockedUsers: user.blockedUsers })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get blocked users' })
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

// Block/unblock user
router.post('/:userId/block', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId === req.params.userId) {
      return res.status(400).json({ message: 'Cannot block yourself' })
    }

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isBlocked = user.blockedUsers.includes(req.params.userId as any)

    if (isBlocked) {
      user.blockedUsers = user.blockedUsers.filter(
        (id) => id.toString() !== req.params.userId
      )
    } else {
      user.blockedUsers.push(req.params.userId as any)
      // Also unfollow if following
      user.following = user.following.filter(
        (id) => id.toString() !== req.params.userId
      )
      await User.findByIdAndUpdate(req.params.userId, {
        $pull: { followers: req.userId, following: req.userId },
      })
    }
    await user.save()

    res.json({ blocked: !isBlocked })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to block user' })
  }
})

// Change password
router.put('/me/password', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save() // triggers the pre-save hash hook

    res.json({ message: 'Password updated successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to change password' })
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
