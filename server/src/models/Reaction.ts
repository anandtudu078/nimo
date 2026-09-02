import mongoose, { Document, Schema } from 'mongoose'

export interface IReaction extends Document {
  user: mongoose.Types.ObjectId
  post: mongoose.Types.ObjectId
  emoji: string
  createdAt: Date
}

const reactionSchema = new Schema<IReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    emoji: { type: String, required: true, enum: ['❤️', '🔥', '😂', '😮', '😢', '👍'] },
  },
  { timestamps: true }
)

// One reaction per user per post
reactionSchema.index({ user: 1, post: 1 }, { unique: true })
reactionSchema.index({ post: 1, emoji: 1 })

export default mongoose.model<IReaction>('Reaction', reactionSchema)
