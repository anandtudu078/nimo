import { Router, Response } from 'express'
import User from '../models/User'
import Post from '../models/Post'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Search users and posts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, type, studyYear } = req.query
    if (!q && !studyYear) {
      return res.json({ users: [], posts: [] })
    }

    const query = (q as string) || ''
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedQuery, 'i')

    // Build user filter
    const userFilter: any[] = []
    if (query) {
      userFilter.push({ $or: [{ username: regex }, { displayName: regex }] })
    }
    if (studyYear) {
      userFilter.push({ studyYear: studyYear as string })
    }
    const userQuery = userFilter.length > 0 ? { $and: userFilter } : {}

    if (type === 'users') {
      const users = await User.find(userQuery)
        .limit(20)
        .select('username displayName avatar bio studyYear')
      return res.json({ users })
    }

    if (type === 'posts') {
      if (!query) return res.json({ posts: [] })
      const posts = await Post.find({ content: regex })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('author', 'username displayName avatar')
        .populate('comments.author', 'username displayName')
      return res.json({ posts })
    }

    // Default: search both
    const [users, posts] = await Promise.all([
      User.find(userQuery)
        .limit(10)
        .select('username displayName avatar bio studyYear'),
      query
        ? Post.find({ content: regex })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('author', 'username displayName avatar')
            .populate('comments.author', 'username displayName')
        : [],
    ])

    res.json({ users, posts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to search' })
  }
})

// Search users specifically by batch/study year
router.get('/batch/:studyYear', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { studyYear } = req.params
    const { q } = req.query

    const filter: any = { studyYear }

    // Optional text search within the batch
    if (q) {
      const query = (q as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(query, 'i')
      filter.$or = [{ username: regex }, { displayName: regex }]
    }

    const users = await User.find(filter)
      .limit(50)
      .select('username displayName avatar bio studyYear')

    res.json({ users, studyYear, count: users.length })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to search by batch' })
  }
})

// Get all distinct study years (for filter dropdowns)
router.get('/batches', auth, async (_req: AuthRequest, res: Response) => {
  try {
    const batches = await User.distinct('studyYear', { studyYear: { $ne: '' } })
    res.json({ batches: batches.sort() })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get batches' })
  }
})

export default router
