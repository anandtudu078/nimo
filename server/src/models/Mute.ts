import mongoose, { Document, Schema } from 'mongoose'

export interface IMute extends Document {
  user: mongoose.Types.ObjectId
  targetType: 'user' | 'keyword'
  targetId?: mongoose.Types.ObjectId
  keyword?: string
  createdAt: Date
}

const muteSchema = new Schema<IMute>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['user', 'keyword'], required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    keyword: { type: String, default: null },
  },
  { timestamps: true }
)

// One mute per user per target
muteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { sparse: true })
muteSchema.index({ user: 1, targetType: 1, keyword: 1 }, { sparse: true })
muteSchema.index({ user: 1 })

export default mongoose.model<IMute>('Mute', muteSchema)
