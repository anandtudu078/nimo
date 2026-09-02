import { Router, Response } from 'express'
import Reaction from '../models/Reaction'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

const VALID_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👍']

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
    await Reaction.create({ user: req.userId, post: postId, emoji })
    const currentCount = post.reactionCounts?.get(emoji) || 0
    post.reactionCounts.set(emoji, currentCount + 1)
    await post.save()

    // Notify post author
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        user: post.author,
        from: req.userId,
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
