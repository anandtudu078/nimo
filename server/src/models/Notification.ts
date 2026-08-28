import mongoose, { Document, Schema } from 'mongoose'

export interface INotification extends Document {
  user: mongoose.Types.ObjectId
  from: mongoose.Types.ObjectId
  type: 'like' | 'comment' | 'follow' | 'mention'
  post?: mongoose.Types.ObjectId
  read: boolean
  createdAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'comment', 'follow', 'mention'], required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model<INotification>('Notification', notificationSchema)
