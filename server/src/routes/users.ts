import { Router, Response } from 'express'
import User from '../models/User'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { Message, Conversation } from '../models/Message'
import Poll from '../models/Poll'
import Repost from '../models/Repost'
import Reaction from '../models/Reaction'
import View from '../models/View'
import Connection from '../models/Connection'
import Draft from '../models/Draft'
import Mute from '../models/Mute'
import PasswordReset from '../models/PasswordReset'
import EmailVerification from '../models/EmailVerification'
import Hashtag from '../models/Hashtag'
import { notifyOnce } from '../utils/notify'
import { auth, AuthRequest } from '../middleware/auth'
import { upload, uploadToCloudinary } from '../config/cloudinary'

const router = Router()

// Case-insensitive exact username match (usernames keep original case in the DB)
function exactCaseInsensitive(username: string) {
  return new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

// Local hashtag extraction (same pattern as posts.ts) for account-deletion cleanup
function extractHashtagsFromContent(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : []
}

// Upload avatar (via Cloudinary)
// Wrap multer middleware to catch promise rejections (multer v2 is async)
const handleAvatarUpload = async (req: AuthRequest, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    upload.single('avatar')(req as any, res as any, (err: any) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

const handleBannerUpload = async (req: AuthRequest, res: Response) => {
  await new Promise<void>((resolve, reject) => {
    upload.single('banner')(req as any, res as any, (err: any) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

router.post('/avatar', auth, async (req: AuthRequest, res: Response) => {
  try {
    await handleAvatarUpload(req, res)

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
    console.error('[Avatar Upload] Stack:', error.stack)
    if (error.message && error.message.includes('Missing Cloudinary')) {
      return res.status(503).json({ message: 'Image upload service is not configured' })
    }
    const statusCode = error.code && error.code.startsWith('LIMIT_') ? 400 : 500
    res.status(statusCode).json({ message: error.message || 'Failed to upload avatar' })
  }
})

// Upload profile banner
router.post('/banner', auth, async (req: AuthRequest, res: Response) => {
  try {
    await handleBannerUpload(req, res)

    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' })
    }

    const bannerUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname)
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profileBanner: bannerUrl },
      { new: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ user, bannerUrl })
  } catch (error: any) {
    console.error('[Banner Upload] Error:', error.message || error)
    const statusCode = error.code && error.code.startsWith('LIMIT_') ? 400 : 500
    res.status(statusCode).json({ message: error.message || 'Failed to upload banner' })
  }
})

// Pin/unpin a post on profile
router.put('/me/pin-post', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.body

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Toggle pin: if same post, unpin it
    if (user.pinnedPost?.toString() === postId) {
      user.pinnedPost = undefined
    } else {
      // Verify post exists and belongs to user
      const post = await Post.findById(postId)
      if (!post) return res.status(404).json({ message: 'Post not found' })
      if (post.author.toString() !== req.userId) {
        return res.status(403).json({ message: 'Can only pin your own posts' })
      }
      user.pinnedPost = postId
    }
    await user.save()

    res.json({ pinnedPost: user.pinnedPost || null })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to pin post' })
  }
})

// Update profile
router.put('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, bio, website, avatar, profileBanner, studyYear } = req.body
    const updateData: Record<string, any> = {}
    if (displayName !== undefined) updateData.displayName = displayName
    if (bio !== undefined) updateData.bio = bio
    if (website !== undefined) updateData.website = website
    if (avatar !== undefined) updateData.avatar = avatar
    if (profileBanner !== undefined) updateData.profileBanner = profileBanner
    if (studyYear !== undefined) updateData.studyYear = studyYear
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

      // Create notification (deduped — follow/unfollow cycles don't re-alert)
      await notifyOnce({
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

// Look up a user by username (for @mention links)
router.get('/username/:username', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ username: exactCaseInsensitive(String(req.params.username)) })
      .select('_id username displayName avatar')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get user' })
  }
})

// Get user profile (with pinned post populated)
router.get('/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    // Explicit public allowlist — a denylist ('-password') previously leaked
    // email, push tokens, bookmarks, and mute/block lists of ANY user.
    const publicFields =
      'username displayName avatar bio website profileBanner studyYear isVerified followers following pinnedPost createdAt'
    const user = await User.findById(req.params.userId)
      .select(publicFields)
      .populate({
        path: 'pinnedPost',
        populate: { path: 'author', select: 'username displayName avatar' },
      })
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

    // ObjectId arrays must be compared as strings — includes() against a raw string always misses
    const isBlocked = user.blockedUsers.some((id) => id.toString() === req.params.userId)

    if (isBlocked) {
      user.blockedUsers = user.blockedUsers.filter(
        (id) => id.toString() !== req.params.userId
      )
    } else {
      user.blockedUsers.push(req.params.userId as any)
      // Also unfollow in both directions (blocker stops following target…)
      user.following = user.following.filter(
        (id) => id.toString() !== req.params.userId
      )
      // …and remove the blocker from the target's follower list too
      await User.findByIdAndUpdate(req.params.userId, {
        $pull: { followers: req.userId },
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

    const user = await User.findById(req.userId).select('+tokenVersion')
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save() // triggers the pre-save hash hook

    // Invalidate all existing sessions (other devices / stolen tokens)
    await User.findByIdAndUpdate(user._id, { $inc: { tokenVersion: 1 } })

    res.json({ message: 'Password updated successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to change password' })
  }
})

// Delete account
router.delete('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Snapshot the user's hashtags before their posts are removed, so the
    // counts can be decremented below.
    const ownPosts = await Post.find({ author: userId }).select('content quotedPost')
    const tagCounts = new Map<string, number>()
    for (const p of ownPosts) {
      for (const tag of extractHashtagsFromContent(p.content || '')) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    // Delete all user's posts (and their attached polls + engagement data)
    const ownPostIds = ownPosts.map((p) => p._id)
    await Poll.deleteMany({ post: { $in: ownPostIds } })
    await Repost.deleteMany({ $or: [{ originalPost: { $in: ownPostIds } }, { user: userId }] })
    await Reaction.deleteMany({ $or: [{ post: { $in: ownPostIds } }, { user: userId }] })
    await View.deleteMany({ post: { $in: ownPostIds } })

    // Posts that quoted any of the deleted posts lose their reference
    await Post.updateMany(
      { quotedPost: { $in: ownPostIds } },
      { $unset: { quotedPost: 1 }, $inc: { shareCount: -1 } }
    )
    await Post.deleteMany({ author: userId })

    // Decrement hashtag counts (documents hitting zero are removed)
    for (const [tag, count] of tagCounts) {
      await Hashtag.findOneAndUpdate(
        { tag },
        { $inc: { count: -count } },
        { new: true }
      ).then((h) => {
        if (h && h.count <= 0) return h.deleteOne()
      })
    }

    // Remove the user's likes/comments from other people's posts
    await Post.updateMany(
      { likes: userId },
      { $pull: { likes: userId } }
    )
    await Post.updateMany(
      { 'comments.author': userId },
      { $pull: { comments: { author: userId } } }
    )

    // Remove user from all followers/following/muted lists
    await User.updateMany(
      { $or: [{ followers: userId }, { following: userId }, { mutedUsers: userId }, { blockedUsers: userId }] },
      { $pull: { followers: userId, following: userId, mutedUsers: userId, blockedUsers: userId } }
    )

    // Delete all notifications for/from this user
    await Notification.deleteMany({ $or: [{ user: userId }, { from: userId }] })

    // Conversations: remove messages the user sent, then delete any
    // conversation they participated in (1:1 chats become empty).
    await Message.deleteMany({ sender: userId })
    const conversations = await Conversation.find({ participants: userId }).select('_id')
    const convIds = conversations.map((c) => c._id)
    if (convIds.length > 0) {
      await Message.deleteMany({ conversation: { $in: convIds } })
      await Conversation.deleteMany({ _id: { $in: convIds } })
    }

    // Delete remaining per-user records
    await Connection.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] })
    await Draft.deleteMany({ author: userId })
    await Mute.deleteMany({ user: userId })
    await PasswordReset.deleteMany({ user: userId })
    await EmailVerification.deleteMany({ user: userId })

    // Delete the user itself
    await User.findByIdAndDelete(userId)

    res.json({ message: 'Account deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete account' })
  }
})

export default router
