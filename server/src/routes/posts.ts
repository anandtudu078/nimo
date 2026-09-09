import { Router, Response } from 'express'
import Post from '../models/Post'
import User from '../models/User'
import Poll from '../models/Poll'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'
import Hashtag from '../models/Hashtag'
import { spamFilter, checkContent } from '../middleware/spamFilter'

const router = Router()

const postPopulate = [
  { path: 'author', select: 'username displayName avatar' },
  { path: 'comments.author', select: 'username displayName avatar' },
  { path: 'poll' },
  {
    path: 'quotedPost',
    populate: [
      { path: 'author', select: 'username displayName avatar' },
      { path: 'poll' },
    ],
  },
]

// Helper: extract hashtags from text
function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ? [...new Set(matches.map((h) => h.slice(1).toLowerCase()))] : []
}

// Helper: extract @mentions (lowercased usernames)
function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g)
  return matches ? [...new Set(matches.map((m) => m.slice(1).toLowerCase()))] : []
}

// Resolve mentioned usernames to users, skipping the mention's author.
// Usernames keep their original case in the DB, so match case-insensitively.
function exactCaseInsensitive(username: string) {
  return new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

async function resolveMentionedUsers(text: string, authorId: string) {
  const usernames = extractMentions(text)
  if (usernames.length === 0) return []
  return User.find({
    $or: usernames.map((u) => ({ username: exactCaseInsensitive(u) })),
    _id: { $ne: authorId },
  }).select('_id username blockedUsers')
}

// Create mention notifications, respecting blocks and skipping duplicates
async function createMentionNotifications(
  mentionedUsers: any[],
  fromUserId: string,
  postId: any
) {
  if (mentionedUsers.length === 0) return
  const author = await User.findById(fromUserId).select('blockedUsers')
  const authorBlocked = (author?.blockedUsers || []).map((id: any) => id.toString())

  const seen = new Set<string>()
  for (const mentioned of mentionedUsers) {
    const userId = mentioned._id.toString()
    if (seen.has(userId)) continue
    seen.add(userId)
    // Skip if either side has blocked the other
    const targetBlocked = (mentioned.blockedUsers || []).map((id: any) => id.toString())
    if (authorBlocked.includes(userId) || targetBlocked.includes(fromUserId)) continue
    await Notification.create({ user: userId, from: fromUserId, type: 'mention', post: postId })
  }
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
    const regex = new RegExp(`#${tag}\\b`, 'i')
    const posts = await Post.find({ content: regex })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate(postPopulate)
    res.json({ posts, tag })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to search hashtags' })
  }
})

// Create post (with spam filter, optional poll, and optional quotedPost)
router.post('/', auth, spamFilter, async (req: AuthRequest, res: Response) => {
  try {
    const { content, images, poll, quotedPostId } = req.body
    const post = new Post({ author: req.userId, content, images })

    // Optional Quoted Post
    if (quotedPostId) {
      const quoted = await Post.findById(quotedPostId)
      if (quoted) {
        post.quotedPost = quoted._id as any
        await Post.findByIdAndUpdate(quotedPostId, { $inc: { shareCount: 1 } })
        if (quoted.author.toString() !== req.userId) {
          await Notification.create({
            user: quoted.author,
            from: req.userId,
            type: 'repost',
            post: post._id,
          })
        }
      }
    }

    await post.save()

    // Optional Poll
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
      const validOptions = poll.options
        .map((opt: string) => String(opt || '').trim())
        .filter((opt: string) => opt.length > 0)
        .slice(0, 6)

      if (validOptions.length >= 2) {
        const hours = Number(poll.durationHours) || 24
        const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000)
        const pollDoc = new Poll({
          post: post._id,
          options: validOptions.map((text: string) => ({ text, voters: [] })),
          endsAt,
        })
        await pollDoc.save()
        post.poll = pollDoc._id as any
        await post.save()
      }
    }

    await post.populate(postPopulate)

    // Track hashtags
    const tags = extractHashtags(content || '')
    if (tags.length > 0) await updateHashtags(tags, 1)

    // Notify mentioned users
    const mentioned = await resolveMentionedUsers(content || '', req.userId!)
    await createMentionNotifications(mentioned, req.userId!, post._id)

    res.status(201).json(post)
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create post' })
  }
})

// Get single post by ID
router.get('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const post = await Post.findById(req.params.id).populate(postPopulate)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    res.json({ post })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch post' })
  }
})

// Get feed — tab=following (posts from people you follow + your own) or tab=foryou (default, all posts)
router.get('/feed', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit
    const tab = req.query.tab === 'following' ? 'following' : 'foryou'

    // Exclude posts from blocked users
    const currentUser = await User.findById(req.userId).select('blockedUsers following')
    const blockedIds = currentUser?.blockedUsers || []

    let authorFilter: Record<string, any> = { $nin: blockedIds }
    if (tab === 'following') {
      const followingIds = currentUser?.following || []
      // Include your own posts so the tab is never empty of your own activity
      const visibleIds = [...followingIds, req.userId]
      authorFilter = { $in: visibleIds, $nin: blockedIds }
    }

    const query = { author: authorFilter }
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(postPopulate)

    const total = await Post.countDocuments(query)

    res.json({ posts, total, page, pages: Math.ceil(total / limit), tab })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch posts' })
  }
})

// Get user's liked posts
router.get('/user/:userId/liked', auth, async (req: AuthRequest, res: Response) => {
  try {
    const posts = await Post.find({ likes: req.params.userId })
      .sort({ createdAt: -1 })
      .populate(postPopulate)

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
      .populate(postPopulate)

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

    // Create notification for the post author
    if (post.author.toString() !== req.userId) {
      await Notification.create({
        user: post.author,
        from: req.userId,
        type: 'comment',
        post: post._id,
      })
    }

    // Notify mentioned users (a comment can mention anyone, including the author)
    const mentioned = await resolveMentionedUsers(content, req.userId!)
    await createMentionNotifications(mentioned, req.userId!, post._id)

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
    const oldMentions = extractMentions(post.content)

    if (content !== undefined) post.content = content
    if (images !== undefined) post.images = images
    await post.save()

    // Update hashtags
    const newTags = extractHashtags(post.content)
    const removedTags = oldTags.filter((t) => !newTags.includes(t))
    const addedTags = newTags.filter((t) => !oldTags.includes(t))
    if (removedTags.length > 0) await updateHashtags(removedTags, -1)
    if (addedTags.length > 0) await updateHashtags(addedTags, 1)

    // Notify only newly mentioned users (edits don't re-ping existing mentions)
    const newMentions = extractMentions(post.content)
    const addedMentions = newMentions.filter((m) => !oldMentions.includes(m))
    if (addedMentions.length > 0) {
      const mentioned = await User.find({
        $or: addedMentions.map((u) => ({ username: exactCaseInsensitive(u) })),
        _id: { $ne: req.userId },
      }).select('_id username blockedUsers')
      await createMentionNotifications(mentioned, req.userId!, post._id)
    }

    await post.populate(postPopulate)

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

    // Clean up poll if attached
    await Poll.deleteOne({ post: req.params.id })

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
      populate: postPopulate,
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ posts: user.bookmarks })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get bookmarks' })
  }
})

export default router
