import mongoose from 'mongoose'
import Notification from '../models/Notification'

type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'reaction'
  | 'repost'
  | 'connection_request'
  | 'connection_accepted'

interface NotifyInput {
  user: mongoose.Types.ObjectId | string
  from: mongoose.Types.ObjectId | string
  type: NotificationType
  post?: mongoose.Types.ObjectId | string | null
  emoji?: string
}

// Create a notification unless an identical unread one already exists.
// Prevents like → unlike → like (or reaction/repost toggling) from piling up
// duplicate alerts. Distinct-content types (comment, mention) should keep
// using Notification.create directly since each event is genuinely new.
export async function notifyOnce(payload: NotifyInput) {
  const query: Record<string, unknown> = {
    user: payload.user,
    from: payload.from,
    type: payload.type,
    post: payload.post ?? null,
    read: false,
  }
  // Different emojis are different notifications — match on emoji for reactions
  if (payload.type === 'reaction' && payload.emoji) {
    query.emoji = payload.emoji
  }

  const existing = await Notification.findOne(query)
  if (existing) return existing
  return Notification.create(payload)
}
