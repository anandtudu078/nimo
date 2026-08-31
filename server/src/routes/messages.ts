import { Router, Response } from 'express'
import { Message, Conversation } from '../models/Message'
import User from '../models/User'
import { auth, AuthRequest } from '../middleware/auth'
import { emitToUser } from '../config/socket'

const router = Router()

// Get all conversations
router.get('/conversations', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', 'username displayName avatar')
      .sort({ updatedAt: -1 })

    // Calculate unread counts for each conversation
    const convIds = conversations.map(c => c._id)
    const unreadCounts = await Message.aggregate([
      { $match: { conversation: { $in: convIds }, sender: { $ne: req.userId }, read: false } },
      { $group: { _id: '$conversation', count: { $sum: 1 } } }
    ])
    const unreadMap = new Map(unreadCounts.map((u: any) => [u._id.toString(), u.count]))

    // Transform to include the other participant
    const transformed = conversations.map((conv) => {
      const participant = conv.participants.find(
        (p: any) => p._id.toString() !== req.userId
      )
      return {
        _id: conv._id,
        participant,
        lastMessage: conv.lastMessage,
        unreadCount: unreadMap.get(conv._id.toString()) || 0,
      }
    })

    res.json({ conversations: transformed })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch conversations' })
  }
})

// Get total unread message count
router.get('/unread-count', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversations = await Conversation.find({ participants: req.userId }).select('_id')
    const convIds = conversations.map(c => c._id)
    const count = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: req.userId },
      read: false,
    })
    res.json({ count })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get unread count' })
  }
})

// Get or create conversation with a user
router.post('/conversation/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const otherUser = await User.findById(req.params.userId)
    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, req.params.userId] },
    })

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.userId, req.params.userId],
      })
      await conversation.save()
    }

    await conversation.populate('participants', 'username displayName avatar')
    res.json({ conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create conversation' })
  }
})

// Get messages in a conversation
router.get('/:conversationId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await Message.find({ conversation: req.params.conversationId })
      .sort({ createdAt: 1 })
      .populate('sender', 'username displayName')

    res.json({ messages })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch messages' })
  }
})

// Send message
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, content } = req.body

    const message = new Message({
      conversation: conversationId,
      sender: req.userId,
      content,
    })
    await message.save()
    await message.populate('sender', 'username displayName')

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { content, sender: req.userId, createdAt: new Date() },
      updatedAt: new Date(),
    })

    // Emit real-time event to other participants
    const conversation = await Conversation.findById(conversationId)
    if (conversation) {
      const io = req.app.get('io')
      conversation.participants.forEach((participantId: any) => {
        if (participantId.toString() !== req.userId) {
          emitToUser(io, participantId.toString(), 'new_message_notification', {
            conversationId,
            message,
          })
        }
      })
    }

    res.status(201).json({ message })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send message' })
  }
})

// Mark messages as read
router.put('/:conversationId/read', auth, async (req: AuthRequest, res: Response) => {
  try {
    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.userId }, read: false },
      { read: true }
    )
    res.json({ message: 'Messages marked as read' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark messages as read' })
  }
})

export default router
