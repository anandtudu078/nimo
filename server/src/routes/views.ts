import { Router, Response } from 'express'
import View from '../models/View'
import Post from '../models/Post'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Record a post view (deduplicates per user or IP)
router.post('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params
    const post = await Post.findById(postId)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    // Don't count self-views
    if (post.author.toString() === req.userId) {
      return res.json({ counted: false })
    }

    // Check if already viewed (deduplicate per user)
    const existing = await View.findOne({ user: req.userId, post: postId })
    if (existing) {
      return res.json({ counted: false })
    }

    // Record view
    await View.create({ user: req.userId, post: postId })
    await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } })

    res.json({ counted: true, viewCount: post.viewCount + 1 })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to record view' })
  }
})

// Get post analytics (for post author)
router.get('/:postId/analytics', auth, async (req: AuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.postId)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Get view count
    const viewCount = post.viewCount || 0

    // Get views over last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const dailyViews = await View.aggregate([
      { $match: { post: post._id, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          views: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // Get unique viewers
    const uniqueViewers = await View.distinct('user', { post: post._id })

    // Get viewer details (top 10)
    const recentViewers = await View.find({ post: post._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'username displayName avatar')

    res.json({
      viewCount,
      uniqueViewers: uniqueViewers.length,
      dailyViews,
      recentViewers: recentViewers.map(v => v.user),
      likeCount: post.likes.length,
      commentCount: post.comments.length,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get analytics' })
  }
})

// Get user's overall analytics
router.get('/user/analytics', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId

    // Total views across all posts
    const totalViews = await View.aggregate([
      {
        $lookup: {
          from: 'posts',
          localField: 'post',
          foreignField: '_id',
          as: 'postData',
        },
      },
      { $unwind: '$postData' },
      { $match: { 'postData.author': userId } },
      { $count: 'total' },
    ])

    // Total likes across all posts
    const posts = await Post.find({ author: userId }).select('likes viewCount')
    const totalLikes = posts.reduce((sum, p) => sum + p.likes.length, 0)
    const totalPostViews = posts.reduce((sum, p) => sum + (p.viewCount || 0), 0)

    // Top performing posts
    const topPosts = await Post.find({ author: userId })
      .sort({ viewCount: -1 })
      .limit(5)
      .select('content viewCount likes comments createdAt')
      .populate('author', 'username displayName avatar')

    res.json({
      totalViews: totalPostViews,
      totalLikes,
      totalPosts: posts.length,
      topPosts,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get user analytics' })
  }
})

export default router
