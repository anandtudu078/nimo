import mongoose, { Document, Schema } from 'mongoose'

export interface IPollOption {
  text: string
  voters: mongoose.Types.ObjectId[]
}

export interface IPoll extends Document {
  post: mongoose.Types.ObjectId
  options: IPollOption[]
  endsAt: Date
  totalVotes: number
  createdAt: Date
  updatedAt: Date
}

const pollOptionSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 100 },
    voters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
)

const pollSchema = new Schema<IPoll>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    options: { type: [pollOptionSchema], required: true, minlength: 2, maxlength: 6 },
    endsAt: { type: Date, required: true },
    totalVotes: { type: Number, default: 0 },
  },
  { timestamps: true }
)

pollSchema.index({ post: 1 })
pollSchema.index({ endsAt: 1 })

export default mongoose.model<IPoll>('Poll', pollSchema)
