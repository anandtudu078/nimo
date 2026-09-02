import { Router, Response } from 'express'
import Mute from '../models/Mute'
import User from '../models/User'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Toggle mute user
router.post('/user/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId === req.params.userId) {
      return res.status(400).json({ message: 'Cannot mute yourself' })
    }

    const targetUser = await User.findById(req.params.userId)
    if (!targetUser) return res.status(404).json({ message: 'User not found' })

    const existing = await Mute.findOne({
      user: req.userId,
      targetType: 'user',
      targetId: req.params.userId,
    })

    if (existing) {
      // Unmute
      await existing.deleteOne()
      // Remove from user's mutedUsers array
      await User.findByIdAndUpdate(req.userId, {
        $pull: { mutedUsers: req.params.userId },
      })
      return res.json({ muted: false })
    }

    // Mute
    await Mute.create({
      user: req.userId,
      targetType: 'user',
      targetId: req.params.userId,
    })
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { mutedUsers: req.params.userId },
    })

    res.json({ muted: true })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle mute user' })
  }
})

// Toggle mute keyword
router.post('/keyword', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { keyword } = req.body
    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({ message: 'Keyword is required' })
    }

    const normalizedKeyword = keyword.trim().toLowerCase()

    const existing = await Mute.findOne({
      user: req.userId,
      targetType: 'keyword',
      keyword: normalizedKeyword,
    })

    if (existing) {
      // Unmute
      await existing.deleteOne()
      await User.findByIdAndUpdate(req.userId, {
        $pull: { mutedKeywords: normalizedKeyword },
      })
      return res.json({ muted: false, keyword: normalizedKeyword })
    }

    // Mute
    await Mute.create({
      user: req.userId,
      targetType: 'keyword',
      keyword: normalizedKeyword,
    })
    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { mutedKeywords: normalizedKeyword },
    })

    res.json({ muted: true, keyword: normalizedKeyword })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle mute keyword' })
  }
})

// Get muted users
router.get('/users', auth, async (req: AuthRequest, res: Response) => {
  try {
    const mutes = await Mute.find({ user: req.userId, targetType: 'user' })
      .populate('targetId', 'username displayName avatar')
    res.json({ mutedUsers: mutes.map(m => m.targetId) })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get muted users' })
  }
})

// Get muted keywords
router.get('/keywords', auth, async (req: AuthRequest, res: Response) => {
  try {
    const mutes = await Mute.find({ user: req.userId, targetType: 'keyword' })
      .select('keyword')
    res.json({ mutedKeywords: mutes.map(m => m.keyword) })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get muted keywords' })
  }
})

// Check if a user or keyword is muted
router.get('/check', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, keyword } = req.query

    if (userId) {
      const muted = await Mute.findOne({
        user: req.userId,
        targetType: 'user',
        targetId: userId,
      })
      return res.json({ muted: !!muted })
    }

    if (keyword) {
      const muted = await Mute.findOne({
        user: req.userId,
        targetType: 'keyword',
        keyword: (keyword as string).toLowerCase(),
      })
      return res.json({ muted: !!muted })
    }

    res.status(400).json({ message: 'Provide userId or keyword query parameter' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to check mute status' })
  }
})

export default router
