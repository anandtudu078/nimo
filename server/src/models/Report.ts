import mongoose, { Document, Schema } from 'mongoose'

export interface IReport extends Document {
  reporter: mongoose.Types.ObjectId
  targetType: 'post' | 'user'
  targetId: mongoose.Types.ObjectId
  reason: string
  description?: string
  status: 'pending' | 'reviewed' | 'resolved'
  createdAt: Date
  updatedAt: Date
}

const reportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: 'targetType' },
    reason: {
      type: String,
      required: true,
      enum: [
        'spam',
        'harassment',
        'hate_speech',
        'violence',
        'nudity',
        'misinformation',
        'copyright',
        'other',
      ],
    },
    description: { type: String, maxlength: 500, default: '' },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  },
  { timestamps: true }
)

// One report per user per target
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true })
reportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model<IReport>('Report', reportSchema)
