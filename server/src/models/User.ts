import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  username: string
  displayName: string
  email: string
  password: string
  avatar?: string
  bio?: string
  website?: string
  profileBanner?: string
  pinnedPost?: mongoose.Types.ObjectId
  isVerified: boolean
  emailVerified: boolean
  fcmTokens: string[]
  followers: mongoose.Types.ObjectId[]
  following: mongoose.Types.ObjectId[]
  bookmarks: mongoose.Types.ObjectId[]
  blockedUsers: mongoose.Types.ObjectId[]
  mutedUsers: mongoose.Types.ObjectId[]
  mutedKeywords: string[]
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 160 },
    website: { type: String, default: '' },
    profileBanner: { type: String, default: '' },
    pinnedPost: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    fcmTokens: [{ type: String }],
    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    bookmarks: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    mutedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    mutedKeywords: [{ type: String }]
  },
  { timestamps: true }
)

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.set('toJSON', {
  transform: (doc: any, ret: any) => {
    delete ret.password
    return ret
  },
})

export default mongoose.model<IUser>('User', userSchema)
