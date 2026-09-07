import mongoose, { Document, Schema } from 'mongoose'

export type ConnectionStatus = 'pending' | 'accepted' | 'declined'

export interface IConnection extends Document {
  requester: mongoose.Types.ObjectId
  recipient: mongoose.Types.ObjectId
  status: ConnectionStatus
  createdAt: Date
  updatedAt: Date
}

const connectionSchema = new Schema<IConnection>(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
)

// The same two users should only ever have one connection document
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true })

export default mongoose.model<IConnection>('Connection', connectionSchema)
