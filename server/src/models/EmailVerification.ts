import mongoose, { Document, Schema } from 'mongoose'

export interface IEmailVerification extends Document {
  user: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  verified: boolean
  createdAt: Date
}

const emailVerificationSchema = new Schema<IEmailVerification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
)

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IEmailVerification>('EmailVerification', emailVerificationSchema)
