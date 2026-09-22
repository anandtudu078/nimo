import { Router, Response } from 'express'
import mongoose from 'mongoose'
import Reaction from '../models/Reaction'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { notifyOnce } from '../utils/notify'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

const VALID_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👍']

// Batch: which of the given posts has the caller reacted to, and with which
// emoji? Feed pages call this once per page instead of once per card, so a
// 20-post feed costs 1 request instead of 20. Must be declared before
// GET /:postId, otherwise "check-multiple" is captured as a :postId param.
router.post('/check-multiple', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postIds } = req.body as { postIds?: unknown }
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.json({ reactions: {} })
    }
    // Only accept well-formed ObjectIds; anything else is ignored rather
    // than letting a bad value cast-error the whole query.
    const validIds = postIds.filter((id) => typeof id === 'string' && mongoose.isValidObjectId(id))
    if (validIds.length === 0) {
      return res.json({ reactions: {} })
    }
    if (validIds.length > 200) {
      return res.status(400).json({ message: 'Too many postIds (max 200)' })
    }

    const mine = await Reaction.find({ user: req.userId, post: { $in: validIds } }).select('post emoji')
    const reactions: Record<string, string> = {}
    for (const r of mine) {
      reactions[r.post.toString()] = r.emoji
    }
    res.json({ reactions })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to check reactions' })
  }
})

// Toggle reaction on a post
router.post('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params
    const { emoji } = req.body

    if (!emoji || !VALID_EMOJIS.includes(emoji)) {
      return res.status(400).json({ message: `Invalid emoji. Valid: ${VALID_EMOJIS.join(', ')}` })
    }

    const post = await Post.findById(postId)
    if (!post) return res.status(404).json({ message: 'Post not found' })

    // Check if user already reacted with this emoji
    const existing = await Reaction.findOne({ user: req.userId, post: postId, emoji })
    if (existing) {
      // Remove reaction
      await existing.deleteOne()
      const currentCount = post.reactionCounts?.get(emoji) || 0
      post.reactionCounts.set(emoji, Math.max(0, currentCount - 1))
      await post.save()
      return res.json({ reacted: false, emoji, reactionCounts: Object.fromEntries(post.reactionCounts) })
    }

    // Remove any other reaction by this user on this post (one reaction type per user)
    const oldReaction = await Reaction.findOneAndDelete({ user: req.userId, post: postId })
    if (oldReaction) {
      const oldCount = post.reactionCounts?.get(oldReaction.emoji) || 0
      post.reactionCounts.set(oldReaction.emoji, Math.max(0, oldCount - 1))
    }

    // Add new reaction
    await Reaction.create({ user: req.userId!, post: postId, emoji })
    const currentCount = post.reactionCounts?.get(emoji) || 0
    post.reactionCounts.set(emoji, currentCount + 1)
    await post.save()

    // Notify post author (deduped — toggling the same emoji doesn't re-alert)
    if (post.author.toString() !== req.userId) {
      await notifyOnce({
        user: post.author,
        from: req.userId!,
        type: 'reaction',
        post: post._id,
        emoji,
      })
    }

    res.json({ reacted: true, emoji, reactionCounts: Object.fromEntries(post.reactionCounts) })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle reaction' })
  }
})

// Get reactions for a post
router.get('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const reactions = await Reaction.find({ post: req.params.postId })
      .populate('user', 'username displayName avatar')

    // Group by emoji
    const grouped: Record<string, any[]> = {}
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = []
      grouped[r.emoji].push(r)
    }

    res.json({ reactions: grouped, total: reactions.length })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch reactions' })
  }
})

export default router
