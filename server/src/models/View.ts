import mongoose, { Document, Schema } from 'mongoose'

export interface IView extends Document {
  user?: mongoose.Types.ObjectId
  post: mongoose.Types.ObjectId
  ip?: string
  createdAt: Date
}

const viewSchema = new Schema<IView>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
)

// One view per user per post (or per IP for anonymous)
viewSchema.index({ user: 1, post: 1 }, { sparse: true })
viewSchema.index({ post: 1, createdAt: -1 })

export default mongoose.model<IView>('View', viewSchema)
