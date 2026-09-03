import mongoose, { Document, Schema } from 'mongoose'

export interface IHashtag extends Document {
  tag: string
  count: number
  lastUsed: Date
  createdAt: Date
  updatedAt: Date
}

const hashtagSchema = new Schema<IHashtag>(
  {
    tag: { type: String, required: true, unique: true, lowercase: true, trim: true },
    count: { type: Number, default: 1 },
    lastUsed: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

hashtagSchema.index({ count: -1 })

export default mongoose.model<IHashtag>('Hashtag', hashtagSchema)
