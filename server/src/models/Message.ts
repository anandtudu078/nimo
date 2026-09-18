import mongoose, { Document, Schema } from 'mongoose'

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId
  sender: mongoose.Types.ObjectId
  content: string
  read: boolean
  delivered: boolean
  createdAt: Date
}

export interface IConversation extends Document {
  // Groups have > 2 participants; 1:1 DMs keep exactly 2 (legacy behavior)
  isGroup: boolean
  groupName?: string
  groupAvatar?: string
  admin: mongoose.Types.ObjectId[]
  participants: mongoose.Types.ObjectId[]
  lastMessage: {
    content: string
    sender: mongoose.Types.ObjectId
    createdAt: Date
  }
  createdAt: Date
  updatedAt: Date
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    delivered: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const conversationSchema = new Schema<IConversation>(
  {
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: '', maxlength: 50, trim: true },
    groupAvatar: { type: String, default: '' },
    admin: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
      content: String,
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: Date,
    },
  },
  { timestamps: true }
)

messageSchema.index({ conversation: 1, createdAt: 1 })
conversationSchema.index({ participants: 1 })

export const Message = mongoose.model<IMessage>('Message', messageSchema)
export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema)
