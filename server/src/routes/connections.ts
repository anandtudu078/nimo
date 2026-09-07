import { Router, Response } from 'express'
import Connection from '../models/Connection'
import User from '../models/User'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Shared select strings for populated user fields
const USER_FIELDS = 'username displayName avatar'

// Create a "connected" notification when a request is accepted
async function notifyAccepted(recipientId: string, requesterId: string) {
  await Notification.create({
    user: recipientId,
    from: requesterId,
    type: 'connection_accepted',
  })
}

// Send a connection request to :userId
router.post('/:userId/request', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.userId)
    if (userId === req.userId) {
      return res.status(400).json({ message: "You can't connect with yourself" })
    }

    const targetUser = await User.findById(userId)
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Block list: if either user has blocked the other, no requests allowed
    const me = await User.findById(req.userId).select('blockedUsers')
    if (me?.blockedUsers.some((id) => id.toString() === userId)) {
      return res.status(403).json({ message: "You can't connect with a user you blocked" })
    }
    const target = await User.findById(userId).select('blockedUsers')
    if (target?.blockedUsers.some((id) => id.toString() === req.userId)) {
      return res.status(403).json({ message: "You can't connect with this user" })
    }

    // Reuse an existing document (either direction) instead of relying on the unique index
    const existing = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: userId },
        { requester: userId, recipient: req.userId },
      ],
    })

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'You are already connected' })
      }
      if (existing.status === 'pending') {
        // If the other user invited me first, accepting is the natural action
        if (existing.recipient.toString() === req.userId) {
          existing.status = 'accepted'
          await existing.save()
          await notifyAccepted(existing.requester.toString(), req.userId!)
          return res.json({ status: 'accepted', message: 'Connection accepted' })
        }
        return res.status(400).json({ message: 'Connection request already sent' })
      }
      // declined → allow re-request by resetting to pending
      existing.requester = req.userId as any
      existing.recipient = userId as any
      existing.status = 'pending'
      await existing.save()
    } else {
      await Connection.create({ requester: req.userId, recipient: userId, status: 'pending' })
    }

    await Notification.create({
      user: userId,
      from: req.userId,
      type: 'connection_request',
    })

    res.status(201).json({ status: 'pending', message: 'Connection request sent' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send connection request' })
  }
})

// Accept a pending request from :userId
router.post('/:userId/accept', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const connection = await Connection.findOne({
      requester: userId,
      recipient: req.userId,
      status: 'pending',
    })
    if (!connection) {
      return res.status(404).json({ message: 'No pending request from this user' })
    }

    connection.status = 'accepted'
    await connection.save()
    await notifyAccepted(userId, req.userId!)

    res.json({ status: 'accepted', message: 'Connection accepted' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to accept connection' })
  }
})

// Decline a pending request from :userId
router.post('/:userId/decline', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const result = await Connection.deleteOne({
      requester: userId,
      recipient: req.userId,
      status: 'pending',
    })
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No pending request from this user' })
    }
    res.json({ status: 'none', message: 'Connection request declined' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to decline connection' })
  }
})

// Disconnect (or cancel my outgoing request) with :userId
router.delete('/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const result = await Connection.deleteOne({
      $or: [
        { requester: req.userId, recipient: userId },
        { requester: userId, recipient: req.userId },
      ],
    })
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No connection with this user' })
    }
    res.json({ status: 'none', message: 'Disconnected' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to disconnect' })
  }
})

// List all my connections (accepted) + pending incoming requests
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const [connections, requests] = await Promise.all([
      Connection.find({ $or: [{ requester: req.userId }, { recipient: req.userId }] })
        .populate('requester', USER_FIELDS)
        .populate('recipient', USER_FIELDS)
        .sort({ updatedAt: -1 }),
      Connection.find({ recipient: req.userId, status: 'pending' })
        .populate('requester', USER_FIELDS)
        .sort({ updatedAt: -1 }),
    ])

    const accepted = connections
      .filter((c) => c.status === 'accepted')
      .map((c) => {
        const other =
          c.requester._id.toString() === req.userId ? c.recipient : c.requester
        return { _id: c._id, user: other, connectedAt: c.updatedAt }
      })

    res.json({ connections: accepted, requests })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch connections' })
  }
})

// Connection status between me and :userId (for the profile page)
router.get('/status/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = String(req.params.userId)
    const connection = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: userId },
        { requester: userId, recipient: req.userId },
      ],
    })

    if (!connection) {
      return res.json({ status: 'none' })
    }

    const isRequester = connection.requester.toString() === req.userId

    res.json({
      status: connection.status, // 'pending' | 'accepted' | 'declined'
      direction: isRequester ? 'outgoing' : 'incoming',
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch connection status' })
  }
})

export default router
