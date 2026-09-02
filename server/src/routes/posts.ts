import { Router, Response } from 'express'
import Post from '../models/Post'
import User from '../models/User'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'
import Hashtag from '../models/Hashtag'
import { spamFilter, checkContent } from '../middleware/spamFilter'

const router = Router()

// Helper: extract hashtags from text
function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : []
}

// Helper: update hashtag counts
async function updateHashtags(tags: string[], delta: number) {
  for (const tag of tags) {
    if (delta > 0) {
      await Hashtag.findOneAndUpdate(
        { tag },
        { $inc: { count: delta }, $set: { lastUsed: new Date() } },
        { upsert: true }
      )
    } else {
      const hashtag = await Hashtag.findOne({ tag })
      if (hashtag) {
        hashtag.count = Math.max(0, hashtag.count + delta)
        if (hashtag.count === 0) await hashtag.deleteOne()
        else await hashtag.save()
      }
    }
  }
}

// Get trending hashtags
router.get('/trending', auth, async (_req: AuthRequest, res: Response) => {
  try {
    const trending = await Hashtag.find()
      .sort({ count: -1 })
      .limit(10)
      .select('tag count')
    res.json({ hashtags: trending })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch trending' })
  }
})

// Search posts by hashtag
router.get('/hashtag/:tag', auth, async (req: AuthRequest, res: Response) => {
  try {
    const tag = String(req.params.tag).toLowerCase()
    const regex = new RegExp(`#${tag}\b`, 'i')
    const posts = await Post.find({ content: regex })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')
    res.json({ posts, tag })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to search hashtags' })
  }
})

// Create post (with spam filter)
router.post('/', auth, spamFilter, async (req: AuthRequest, res: Response) => {
  try {
    const { content, images } = req.body
    const post = new Post({ author: req.userId, content, images })
    await post.save()
    await post.populate('author', 'username displayName avatar')

    // Track hashtags
    const tags = extractHashtags(content || '')
    if (tags.length > 0) await updateHashtags(tags, 1)

    res.status(201).json(post)
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create post' })
  }
})

// Get feed (all posts, newest first)
router.get('/feed', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    // Exclude posts from blocked users
    const currentUser = await User.findById(req.userId).select('blockedUsers')
    const blockedIds = currentUser?.blockedUsers || []

    const posts = await Post.find({ author: { $nin: blockedIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')

    const total = await Post.countDocuments({ author: { $nin: blockedIds } })

    res.json({ posts, total, page, pages: Math.ceil(total / limit) })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch posts' })
  }
})

// Get user's liked posts
router.get('/user/:userId/liked', auth, async (req: AuthRequest, res: Response) => {
  try {
    const posts = await Post.find({ likes: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')

    res.json({ posts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch liked posts' })
  }
})

// Get user posts
router.get('/user/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate('author', 'username displayName avatar')
      .populate('comments.author', 'username displayName avatar')

    res.json({ posts })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch posts' })
  }
})

// Like/unlike post
router.post('/:id/like', auth, async (req: AuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const index = post.likes.indexOf(req.userId as any)
    if (index === -1) {
      post.likes.push(req.userId as any)
      // Create notification
      if (post.author.toString() !== req.userId) {
        await Notification.create({
          user: post.author,
          from: req.userId,
          type: 'like',
          post: post._id,
        })
      }
    } else {
      post.likes.splice(index, 1)
    }

    await post.save()
    res.json({ likes: post.likes })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to like post' })
  }
})

// Add comment (with spam filter)
router.post('/:id/comment', auth, spamFilter, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const comment = { author: req.userId as any, content }
    post.comments.push(comment as any)
    await post.save()

    await post.populate({ path: 'comments.author', select: 'username displayName avatar' })
    const newComment = post.comments[post.comments.length - 1]

    // Create notification
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        user: post.author,
        from: req.userId,
        type: 'comment',
        post: post._id,
      })
    }

    res.status(201).json(newComment)
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to add comment' })
  }
})

// Edit post
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content, images } = req.body
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Decrement old hashtags
    const oldTags = extractHashtags(post.content)

    if (content !== undefined) post.content = content
    if (images !== undefined) post.images = images
    await post.save()

    // Update hashtags
    const newTags = extractHashtags(post.content)
    const removedTags = oldTags.filter((t) => !newTags.includes(t))
    const addedTags = newTags.filter((t) => !oldTags.includes(t))
    if (removedTags.length > 0) await updateHashtags(removedTags, -1)
    if (addedTags.length > 0) await updateHashtags(addedTags, 1)
    await post.populate('author', 'username displayName avatar')
    await post.populate('comments.author', 'username displayName avatar')

    res.json(post)
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update post' })
  }
})

// Delete post
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }
    if (post.author.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    // Decrement hashtags
    const tags = extractHashtags(post.content)
    if (tags.length > 0) await updateHashtags(tags, -1)

    await Post.findByIdAndDelete(req.params.id)
    res.json({ message: 'Post deleted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete post' })
  }
})

// Toggle bookmark
router.post('/:id/bookmark', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const postId = req.params.id
    const isBookmarked = user.bookmarks.includes(postId as any)

    if (isBookmarked) {
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== postId)
    } else {
      user.bookmarks.push(postId as any)
    }
    await user.save()

    res.json({ bookmarked: !isBookmarked })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle bookmark' })
  }
})

// Get user's bookmarked posts
router.get('/user/:userId/bookmarks', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.userId).populate({
      path: 'bookmarks',
      populate: { path: 'author', select: 'username displayName avatar' },
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ posts: user.bookmarks })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get bookmarks' })
  }
})

export default router
