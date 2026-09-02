import { Router, Response } from 'express'
import Repost from '../models/Repost'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Toggle repost (share/unshare)
router.post('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params
    const { comment } = req.body

    const post = await Post.findById(postId)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    // Check if already reposted
    const existing = await Repost.findOne({ user: req.userId, originalPost: postId })
    if (existing) {
      // Unrepost
      await existing.deleteOne()
      await Post.findByIdAndUpdate(postId, { $inc: { shareCount: -1 } })
      return res.json({ reposted: false, shareCount: Math.max(0, post.shareCount - 1) })
    }

    // Create repost
    await Repost.create({ user: req.userId, originalPost: postId, comment })
    await Post.findByIdAndUpdate(postId, { $inc: { shareCount: 1 } })

    // Notify original author
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        user: post.author,
        from: req.userId,
        type: 'repost',
        post: post._id,
      })
    }

    res.json({ reposted: true, shareCount: post.shareCount + 1 })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle repost' })
  }
})

// Get reposts for a post
router.get('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const reposts = await Repost.find({ originalPost: req.params.postId })
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName avatar')
    res.json({ reposts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch reposts' })
  }
})

// Get user's repost feed
router.get('/user/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const reposts = await Repost.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username displayName avatar')
      .populate({
        path: 'originalPost',
        populate: { path: 'author', select: 'username displayName avatar' },
      })
    res.json({ reposts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch user reposts' })
  }
})

export default router
