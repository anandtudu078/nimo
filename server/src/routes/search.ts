import { Router, Response } from 'express'
import User from '../models/User'
import Post from '../models/Post'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Search users and posts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, type } = req.query
    if (!q) {
      return res.json({ users: [], posts: [] })
    }

    const query = q as string
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedQuery, 'i')

    if (type === 'users') {
      const users = await User.find({
        $or: [{ username: regex }, { displayName: regex }],
      })
        .limit(20)
        .select('username displayName avatar bio')
      return res.json({ users })
    }

    if (type === 'posts') {
      const posts = await Post.find({ content: regex })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('author', 'username displayName avatar')
        .populate('comments.author', 'username displayName')
      return res.json({ posts })
    }

    // Default: search both
    const [users, posts] = await Promise.all([
      User.find({ $or: [{ username: regex }, { displayName: regex }] })
        .limit(10)
        .select('username displayName avatar bio'),
      Post.find({ content: regex })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('author', 'username displayName avatar')
        .populate('comments.author', 'username displayName'),
    ])

    res.json({ users, posts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to search' })
  }
})

export default router
