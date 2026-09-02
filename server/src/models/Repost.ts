import mongoose, { Document, Schema } from 'mongoose'

export interface IRepost extends Document {
  user: mongoose.Types.ObjectId
  originalPost: mongoose.Types.ObjectId
  comment?: string
  createdAt: Date
}

const repostSchema = new Schema<IRepost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    originalPost: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    comment: { type: String, maxlength: 280, default: '' },
  },
  { timestamps: true }
)

// One repost per user per post
repostSchema.index({ user: 1, originalPost: 1 }, { unique: true })
repostSchema.index({ originalPost: 1, createdAt: -1 })
repostSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model<IRepost>('Repost', repostSchema)
