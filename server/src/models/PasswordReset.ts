import mongoose, { Document, Schema } from 'mongoose'

export interface IPasswordReset extends Document {
  user: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
  used: boolean
}

const passwordResetSchema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
)

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema)
