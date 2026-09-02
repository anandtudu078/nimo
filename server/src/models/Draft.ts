import mongoose, { Document, Schema } from 'mongoose'

export interface IDraft extends Document {
  author: mongoose.Types.ObjectId
  content: string
  images: string[]
  scheduledAt?: Date
  status: 'draft' | 'scheduled' | 'published'
  createdAt: Date
  updatedAt: Date
}

const draftSchema = new Schema<IDraft>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '', maxlength: 280 },
    images: [{ type: String }],
    scheduledAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published'],
      default: 'draft',
    },
  },
  { timestamps: true }
)

draftSchema.index({ author: 1, createdAt: -1 })
draftSchema.index({ status: 1, scheduledAt: 1 })

export default mongoose.model<IDraft>('Draft', draftSchema)
