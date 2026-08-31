import { Router, Response } from 'express'
import Post from '../models/Post'
import User from '../models/User'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Create post
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content, images } = req.body
    const post = new Post({ author: req.userId, content, images })
    await post.save()
    await post.populate('author', 'username displayName avatar')
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
      .populate('comments.author', 'username displayName')

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
      .populate('comments.author', 'username displayName')

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
      .populate('comments.author', 'username displayName')

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

// Add comment
router.post('/:id/comment', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body
    const post = await Post.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ message: 'Post not found' })
    }

    const comment = { author: req.userId as any, content }
    post.comments.push(comment as any)
    await post.save()

    await post.populate({ path: 'comments.author', select: 'username displayName' })
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

    if (content !== undefined) post.content = content
    if (images !== undefined) post.images = images
    await post.save()
    await post.populate('author', 'username displayName avatar')
    await post.populate('comments.author', 'username displayName')

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

    await Post.findByIdAndDelete(req.params.id)
    res.json({ message: 'Post deleted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete post' })
  }
})

export default router
