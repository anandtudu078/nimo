import { Router, Response } from 'express'
import Poll from '../models/Poll'
import Post from '../models/Post'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Create poll (attached to a post)
router.post('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params
    const { options, durationHours } = req.body

    const post = await Post.findById(postId)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the post author can add a poll' })
    }

    // Check if poll already exists
    const existing = await Poll.findOne({ post: postId })
    if (existing) return res.status(400).json({ message: 'Poll already exists for this post' })

    if (!options || options.length < 2 || options.length > 6) {
      return res.status(400).json({ message: 'Poll must have 2-6 options' })
    }

    const hours = durationHours || 24
    const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000)

    const poll = new Poll({
      post: postId,
      options: options.map((text: string) => ({ text, voters: [] })),
      endsAt,
    })
    await poll.save()

    res.status(201).json({ poll })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create poll' })
  }
})

// Get poll for a post
router.get('/:postId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const poll = await Poll.findOne({ post: req.params.postId })
    if (!poll) return res.status(404).json({ message: 'Poll not found' })

    const isExpired = new Date() > poll.endsAt
    const userVote = poll.options.findIndex(o =>
      o.voters.some(v => v.toString() === req.userId)
    )

    res.json({
      poll,
      isExpired,
      userVote: userVote >= 0 ? userVote : null,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get poll' })
  }
})

// Vote on a poll
router.post('/:postId/vote', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { optionIndex } = req.body
    const poll = await Poll.findOne({ post: req.params.postId })
    if (!poll) return res.status(404).json({ message: 'Poll not found' })

    if (new Date() > poll.endsAt) {
      return res.status(400).json({ message: 'Poll has ended' })
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ message: 'Invalid option index' })
    }

    // Remove previous vote if any
    let previousVote = -1
    for (let i = 0; i < poll.options.length; i++) {
      const voterIndex = poll.options[i].voters.findIndex(
        v => v.toString() === req.userId
      )
      if (voterIndex >= 0) {
        previousVote = i
        poll.options[i].voters.splice(voterIndex, 1)
        break
      }
    }

    // Add new vote
    poll.options[optionIndex].voters.push(req.userId as any)
    poll.totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0)
    await poll.save()

    res.json({
      poll,
      userVote: optionIndex,
      changedVote: previousVote >= 0,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to vote' })
  }
})

export default router
