import { Router, Response } from 'express'
import Post from '../models/Post'
import User from '../models/User'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Get explore/discover feed (algorithmic ranking)
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    // Exclude posts from blocked/muted users
    const currentUser = await User.findById(req.userId).select('blockedUsers mutedUsers')
    const excludedIds = [
      ...(currentUser?.blockedUsers || []),
      ...(currentUser?.mutedUsers || []),
    ]

    // Algorithm: score posts by engagement and recency
    // Uses a simple weighted score: (likes * 2 + comments * 3 + shares * 4) / (hoursSinceCreation + 2)^1.5
    const posts = await Post.aggregate([
      { $match: { author: { $nin: excludedIds } } },
      {
        $addFields: {
          hoursSinceCreation: {
            $divide: [
              { $subtract: [new Date(), '$createdAt'] },
              3600000, // milliseconds in an hour
            ],
          },
          likeCount: { $size: { $ifNull: ['$likes', []] } },
          commentCount: { $size: { $ifNull: ['$comments', []] } },
        },
      },
      {
        $addFields: {
          score: {
            $divide: [
              {
                $add: [
                  { $multiply: ['$likeCount', 2] },
                  { $multiply: ['$commentCount', 3] },
                ],
              },
              { $pow: [{ $add: ['$hoursSinceCreation', 2] }, 1.5] },
            ],
          },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { username: 1, displayName: 1, avatar: 1 } }],
        },
      },
      { $unwind: '$author' },
    ])

    res.json({ posts, page, limit })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch explore feed' })
  }
})

// Get suggested users (people you don't follow yet, ordered by follower count)
router.get('/suggested', auth, async (req: AuthRequest, res: Response) => {
  try {
    const currentUser = await User.findById(req.userId).select('following blockedUsers')
    const followingIds = currentUser?.following || []
    const blockedIds = currentUser?.blockedUsers || []

    const excludeIds = [...followingIds, ...(blockedIds || []), req.userId]

    const suggestedUsers = await User.find({ _id: { $nin: excludeIds } })
      .sort({ followers: -1 })
      .limit(10)
      .select('username displayName avatar bio followers')

    res.json({ users: suggestedUsers })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch suggested users' })
  }
})

// Get "For You" feed (posts from followed users + trending)
router.get('/foryou', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const skip = (page - 1) * limit

    const currentUser = await User.findById(req.userId).select('following blockedUsers mutedUsers')
    const followingIds = currentUser?.following || []
    const blockedIds = [
      ...(currentUser?.blockedUsers || []),
      ...(currentUser?.mutedUsers || []),
    ]

    // Mix: 70% from followed users, 30% trending from others
    const followedLimit = Math.ceil(limit * 0.7)
    const trendingLimit = limit - followedLimit

    const [followedPosts, trendingPosts] = await Promise.all([
      // Posts from followed users
      Post.find({ author: { $in: followingIds, $nin: blockedIds } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(followedLimit)
        .populate('author', 'username displayName avatar'),
      // Trending posts from non-followed users
      Post.aggregate([
        { $match: { author: { $nin: [...followingIds, ...blockedIds] } } },
        {
          $addFields: {
            hoursSinceCreation: {
              $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000],
            },
            likeCount: { $size: { $ifNull: ['$likes', []] } },
            commentCount: { $size: { $ifNull: ['$comments', []] } },
          },
        },
        {
          $addFields: {
            score: {
              $divide: [
                { $add: [{ $multiply: ['$likeCount', 2] }, { $multiply: ['$commentCount', 3] }] },
                { $pow: [{ $add: ['$hoursSinceCreation', 2] }, 1.5] },
              ],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: trendingLimit },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
            pipeline: [{ $project: { username: 1, displayName: 1, avatar: 1 } }],
          },
        },
        { $unwind: '$author' },
      ]),
    ])

    // Interleave posts: followed first, then trending
    const posts = [...followedPosts, ...trendingPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)

    res.json({ posts, page, limit })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch for you feed' })
  }
})

export default router
