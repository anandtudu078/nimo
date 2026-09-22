import { Router, Response } from 'express'
import Draft from '../models/Draft'
import Post from '../models/Post'
import Hashtag from '../models/Hashtag'
import { auth, AuthRequest } from '../middleware/auth'
import { checkContent } from '../middleware/spamFilter'

// Same hashtag bookkeeping as posts.ts so trending counts stay consistent
function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : []
}

const router = Router()

// Get user's drafts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const drafts = await Draft.find({ author: req.userId, status: { $ne: 'published' } })
      .sort({ updatedAt: -1 })
    res.json({ drafts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch drafts' })
  }
})

// Get user's scheduled posts
router.get('/scheduled', auth, async (req: AuthRequest, res: Response) => {
  try {
    const drafts = await Draft.find({
      author: req.userId,
      status: 'scheduled',
      scheduledAt: { $gt: new Date() },
    }).sort({ scheduledAt: 1 })
    res.json({ drafts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch scheduled posts' })
  }
})

// Create draft
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content, images, scheduledAt } = req.body
    const draft = new Draft({
      author: req.userId,
      content,
      images,
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'draft',
    })
    await draft.save()
    res.status(201).json({ draft })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create draft' })
  }
})

// Update draft
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const draft = await Draft.findOne({ _id: req.params.id, author: req.userId })
    if (!draft) return res.status(404).json({ message: 'Draft not found' })

    const { content, images, scheduledAt } = req.body
    if (content !== undefined) draft.content = content
    if (images !== undefined) draft.images = images
    if (scheduledAt !== undefined) {
      draft.scheduledAt = scheduledAt || null
      draft.status = scheduledAt ? 'scheduled' : 'draft'
    }
    await draft.save()
    res.json({ draft })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update draft' })
  }
})

// Publish draft immediately
router.post('/:id/publish', auth, async (req: AuthRequest, res: Response) => {
  try {
    const draft = await Draft.findOne({ _id: req.params.id, author: req.userId })
    if (!draft) return res.status(404).json({ message: 'Draft not found' })

    // Same validation as POST /posts — schema maxlength truncates silently,
    // and the spam filter must apply to drafts too, not just the composer.
    const content = (draft.content || '').trim()
    const images = Array.isArray(draft.images) ? draft.images : []
    if (!content && images.length === 0) {
      return res.status(400).json({ message: 'Draft is empty' })
    }
    if (content.length > 280) {
      return res.status(400).json({ message: 'Post content must be 280 characters or fewer' })
    }
    if (checkContent(content).isSpam) {
      return res.status(400).json({ message: 'Content flagged as potential spam' })
    }

    // Create post from draft
    const post = new Post({
      author: req.userId,
      content,
      images,
    })
    await post.save()
    await post.populate('author', 'username displayName avatar')

    // Track hashtags (same bookkeeping as normal posting)
    const tags = extractHashtags(content)
    for (const tag of tags) {
      await Hashtag.findOneAndUpdate(
        { tag },
        { $inc: { count: 1 }, $set: { lastUsed: new Date() } },
        { upsert: true }
      )
    }

    // Mark draft as published
    draft.status = 'published'
    await draft.save()

    res.status(201).json({ post, draft })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to publish draft' })
  }
})

// Delete draft
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const draft = await Draft.findOneAndDelete({ _id: req.params.id, author: req.userId })
    if (!draft) return res.status(404).json({ message: 'Draft not found' })
    res.json({ message: 'Draft deleted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete draft' })
  }
})

export default router
