import { Router, Response } from 'express'
import { Message, Conversation } from '../models/Message'
import User from '../models/User'
import Connection from '../models/Connection'
import { auth, AuthRequest } from '../middleware/auth'
import { emitToUser } from '../config/socket'

const router = Router()

// Group helper: is this user an admin of the conversation?
function isAdmin(conversation: any, userId: string): boolean {
  return (conversation.admin || []).some((a: any) => a.toString() === userId)
}

// Users must have an accepted connection before they can message each other
async function requireConnection(a: string | undefined, b: string): Promise<boolean> {
  if (!a) return false
  const connection = await Connection.findOne({
    requester: { $in: [a, b] },
    recipient: { $in: [a, b] },
    status: 'accepted',
  })
  return !!connection
}

// Guard: the requester must be a participant of the conversation (IDOR protection)
async function getConversationForUser(
  conversationId: string | string[],
  userId: string | undefined
) {
  const conversation = await Conversation.findById(String(conversationId))
  if (!conversation) return null
  const isParticipant = conversation.participants.some(
    (p: any) => p.toString() === userId
  )
  return isParticipant ? conversation : null
}

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

    // Transform: DMs expose `participant` (legacy shape); groups expose
    // group metadata plus the full participant list for the client UI.
    const transformed = conversations.map((conv) => {
      if (conv.isGroup) {
        return {
          _id: conv._id,
          isGroup: true,
          groupName: conv.groupName || 'Group',
          groupAvatar: conv.groupAvatar || '',
          admin: conv.admin,
          participants: conv.participants,
          lastMessage: conv.lastMessage,
          unreadCount: unreadMap.get(conv._id.toString()) || 0,
        }
      }
      const participant = conv.participants.find(
        (p: any) => p._id.toString() !== req.userId
      )
      return {
        _id: conv._id,
        isGroup: false,
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

    // Messaging requires an accepted connection
    const connected = await requireConnection(req.userId, String(req.params.userId))
    if (!connected) {
      return res.status(403).json({
        message: 'You need to connect with this user before messaging them',
        code: 'CONNECTION_REQUIRED',
      })
    }

    // Check if conversation already exists — DMs only, so a group that
    // happens to contain both users is never mistaken for a 1:1 chat
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.userId, req.params.userId] },
    })

    if (!conversation) {
      conversation = new Conversation({
        isGroup: false,
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
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

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

    // Validate content before persisting (schema maxlength doesn't reject — it truncates)
    if (typeof content !== 'string' || !content.trim() || content.length > 1000) {
      return res.status(400).json({ message: 'Message must be 1-1000 characters' })
    }

    // Guard: messaging requires an accepted connection
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }
    const isParticipant = conversation.participants.some(
      (p: any) => p.toString() === req.userId
    )
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not a participant of this conversation' })
    }
    // Groups don't require a 1:1 connection — membership is the access gate.
    // DMs still require an accepted connection.
    if (!conversation.isGroup) {
      const connected = await requireConnection(
        req.userId,
        conversation.participants.find((p: any) => p.toString() !== req.userId)?.toString() || ''
      )
      if (!connected) {
        return res.status(403).json({
          message: 'You are no longer connected with this user',
          code: 'CONNECTION_REQUIRED',
        })
      }
    }

    const message = new Message({
      conversation: conversationId,
      sender: req.userId,
      content,
      delivered: false,
    })
    await message.save()
    await message.populate('sender', 'username displayName')

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { content, sender: req.userId, createdAt: new Date() },
      updatedAt: new Date(),
    })

    // Emit real-time event to other participants
    if (conversation) {
      const io = req.app.get('io')
      conversation.participants.forEach((participantId: any) => {
        if (participantId.toString() !== req.userId) {
          emitToUser(io, participantId.toString(), 'new_message_notification', {
            conversationId,
            message,
          })
          // Deliver the full message so open chats update in real time
          emitToUser(io, participantId.toString(), 'new_message', {
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

// Mark messages as delivered
router.put('/:conversationId/delivered', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    const result = await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.userId }, delivered: false },
      { delivered: true }
    )

    // Notify senders that their messages were delivered
    const io = req.app.get('io')
    const undeliveredMessages = await Message.find({
      conversation: req.params.conversationId,
      sender: { $ne: req.userId },
      delivered: true,
    }).select('sender')

    const senderIds = [...new Set(undeliveredMessages.map(m => m.sender.toString()))]
    senderIds.forEach(senderId => {
      emitToUser(io, senderId, 'messages_delivered', {
        conversationId: req.params.conversationId,
        by: req.userId,
      })
    })

    res.json({ message: 'Messages marked as delivered', count: result.modifiedCount })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark messages as delivered' })
  }
})

// Mark messages as read (with read receipts)
router.put('/:conversationId/read', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.userId }, read: false },
      { read: true }
    )

    // Notify senders that their messages were read
    const io = req.app.get('io')
    const unreadMessages = await Message.find({
      conversation: req.params.conversationId,
      sender: { $ne: req.userId },
    }).select('sender')

    const senderIds = [...new Set(unreadMessages.map(m => m.sender.toString()))]
    senderIds.forEach(senderId => {
      emitToUser(io, senderId, 'messages_read', {
        conversationId: req.params.conversationId,
        by: req.userId,
      })
    })

    res.json({ message: 'Messages marked as read' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark messages as read' })
  }
})

// Get read/delivered status for messages in a conversation
router.get('/:conversationId/status', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    const messages = await Message.find({
      conversation: req.params.conversationId,
      sender: req.userId,
    }).select('read delivered createdAt')

    const status = messages.map(m => ({
      messageId: m._id,
      delivered: m.delivered,
      read: m.read,
      createdAt: m.createdAt,
    }))

    res.json({ status })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get message status' })
  }
})

// Create a group chat (creator becomes the first admin)
router.post('/groups', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, memberIds } = req.body as { name?: unknown; memberIds?: unknown }

    const groupName = typeof name === 'string' ? name.trim() : ''
    if (!groupName || groupName.length > 50) {
      return res.status(400).json({ message: 'Group name must be 1-50 characters' })
    }

    // Members must be an array of unique ids that doesn't include the creator
    const rawIds = Array.isArray(memberIds) ? memberIds : []
    if (rawIds.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ message: 'Invalid member list' })
    }
    const memberSet = [...new Set(rawIds as string[])].filter((id) => id !== req.userId)
    const uniqueMembers = [...new Set(memberSet.map((id) => id.toString()))]
    if (uniqueMembers.length < 2) {
      return res.status(400).json({ message: 'A group needs at least 3 members including you' })
    }

    // Verify all members exist and each is a connection of the creator
    const members = await User.find({ _id: { $in: uniqueMembers } }).select('_id blockedUsers')
    if (members.length !== uniqueMembers.length) {
      return res.status(404).json({ message: 'One or more members not found' })
    }
    const creator = await User.findById(req.userId).select('blockedUsers')
    if (!creator) {
      return res.status(404).json({ message: 'User not found' })
    }
    const creatorBlocked = (creator.blockedUsers || []).map((id: any) => id.toString())
    for (const member of members) {
      if (creatorBlocked.includes(member._id.toString())) {
        return res.status(400).json({ message: 'Cannot add a user you have blocked' })
      }
      const memberBlocked = (member.blockedUsers || []).map((id: any) => id.toString())
      if (memberBlocked.includes(req.userId!)) {
        return res.status(400).json({ message: 'Cannot add a user who has blocked you' })
      }
      const connected = await Connection.findOne({
        $or: [
          { requester: req.userId, recipient: member._id },
          { requester: member._id, recipient: req.userId },
        ],
        status: 'accepted',
      })
      if (!connected) {
        return res.status(400).json({
          message: 'All members must be connected with you before being added to a group',
          code: 'CONNECTION_REQUIRED',
        })
      }
    }

    const conversation = await Conversation.create({
      isGroup: true,
      groupName,
      admin: [req.userId],
      participants: [req.userId, ...uniqueMembers],
    })
    await conversation.populate('participants', 'username displayName avatar')

    // Tell every other member a new group exists so it appears in their list
    const io = req.app.get('io')
    uniqueMembers.forEach((memberId) => {
      emitToUser(io, memberId, 'group_created', { conversationId: conversation._id })
    })

    res.status(201).json({ conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create group' })
  }
})

// Get group details (participants, admins, name)
router.get('/groups/:conversationId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    await conversation.populate('participants', 'username displayName avatar')
    res.json({ group: conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch group' })
  }
})

// Admin adds a member to a group
router.post('/groups/:conversationId/members', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }
    if (!isAdmin(conversation, req.userId!)) {
      return res.status(403).json({ message: 'Only group admins can add members' })
    }

    const { userId } = req.body as { userId?: unknown }
    if (typeof userId !== 'string' || !userId) {
      return res.status(400).json({ message: 'User id is required' })
    }
    const alreadyIn = conversation.participants.some(
      (p: any) => p.toString() === userId
    )
    if (alreadyIn) {
      return res.status(400).json({ message: 'User is already a member' })
    }

    const newMember = await User.findById(userId).select('_id blockedUsers')
    if (!newMember) {
      return res.status(404).json({ message: 'User not found' })
    }
    // Respect blocks in both directions
    const newMemberBlocked = (newMember.blockedUsers || []).map((id: any) => id.toString())
    if (newMemberBlocked.includes(req.userId!)) {
      return res.status(403).json({ message: "You can't add this user" })
    }
    // The new member must be connected to the admin adding them
    const connected = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: userId },
        { requester: userId, recipient: req.userId },
      ],
      status: 'accepted',
    })
    if (!connected) {
      return res.status(400).json({
        message: 'You can only add people you are connected with',
        code: 'CONNECTION_REQUIRED',
      })
    }

    conversation.participants.push(userId as any)
    await conversation.save()
    await conversation.populate('participants', 'username displayName avatar')

    // The member's list refreshes via group_created; existing members in the
    // open chat get the participant update so the header stays current.
    const io = req.app.get('io')
    emitToUser(io, userId, 'group_created', { conversationId: conversation._id })
    conversation.participants.forEach((p: any) => {
      const pid = p._id ? p._id.toString() : p.toString()
      if (pid !== req.userId) {
        emitToUser(io, pid, 'group_updated', {
          conversationId: conversation._id,
          participants: conversation.participants,
        })
      }
    })

    res.json({ conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to add member' })
  }
})

// Admin renames a group
router.put('/groups/:conversationId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }
    if (!isAdmin(conversation, req.userId!)) {
      return res.status(403).json({ message: 'Only group admins can rename the group' })
    }

    const { name } = req.body as { name?: unknown }
    const groupName = typeof name === 'string' ? name.trim() : ''
    if (!groupName || groupName.length > 50) {
      return res.status(400).json({ message: 'Group name must be 1-50 characters' })
    }

    conversation.groupName = groupName
    await conversation.save()

    // Tell the other members so their headers and list titles update
    const io = req.app.get('io')
    conversation.participants.forEach((p: any) => {
      const pid = p._id ? p._id.toString() : p.toString()
      if (pid !== req.userId) {
        emitToUser(io, pid, 'group_updated', {
          conversationId: conversation._id,
          groupName,
        })
      }
    })

    res.json({ conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to rename group' })
  }
})

// Admin removes a member from a group
router.delete('/groups/:conversationId/members/:userId', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }
    if (!isAdmin(conversation, req.userId!)) {
      return res.status(403).json({ message: 'Only group admins can remove members' })
    }

    const userId = String(req.params.userId)
    if (userId === req.userId) {
      return res.status(400).json({ message: 'Use leave group instead of removing yourself' })
    }
    if (isAdmin(conversation, userId)) {
      return res.status(403).json({ message: 'Admins cannot remove other admins' })
    }
    const wasMember = conversation.participants.some((p: any) => p.toString() === userId)
    if (!wasMember) {
      return res.status(404).json({ message: 'User is not a member of this group' })
    }

    conversation.participants = conversation.participants.filter(
      (p: any) => p.toString() !== userId
    )
    await conversation.save()
    await conversation.populate('participants', 'username displayName avatar')

    const io = req.app.get('io')
    // The removed user drops the conversation from their list entirely
    emitToUser(io, userId, 'group_removed', { conversationId: conversation._id })
    // Remaining members refresh the participant list
    conversation.participants.forEach((p: any) => {
      const pid = p._id ? p._id.toString() : p.toString()
      if (pid !== req.userId) {
        emitToUser(io, pid, 'group_updated', {
          conversationId: conversation._id,
          participants: conversation.participants,
        })
      }
    })

    res.json({ conversation })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to remove member' })
  }
})

// Leave a group (creator/admin can leave too — group survives without admins)
router.post('/groups/:conversationId/leave', auth, async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await getConversationForUser(req.params.conversationId, req.userId)
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    conversation.participants = conversation.participants.filter(
      (p: any) => p.toString() !== req.userId
    )
    conversation.admin = conversation.admin.filter(
      (p: any) => p.toString() !== req.userId
    )
    await conversation.save()

    // Notify remaining members so they drop the departed user from the header
    const io = req.app.get('io')
    conversation.participants.forEach((p: any) => {
      emitToUser(io, p.toString(), 'group_updated', {
        conversationId: conversation._id,
        participants: conversation.participants,
      })
    })

    res.json({ message: 'You left the group' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to leave group' })
  }
})

export default router
