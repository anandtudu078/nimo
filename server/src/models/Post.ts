import mongoose, { Document, Schema } from 'mongoose'

export interface IComment extends Document {
  author: mongoose.Types.ObjectId
  content: string
  createdAt: Date
}

export interface IPost extends Document {
  author: mongoose.Types.ObjectId
  content: string
  images: string[]
  likes: mongoose.Types.ObjectId[]
  comments: IComment[]
  reactionCounts: Map<string, number>
  createdAt: Date
  updatedAt: Date
}

const commentSchema = new Schema<IComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
)

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '', maxlength: 280 },
    images: [{ type: String }],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [commentSchema],
    reactionCounts: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
)

postSchema.index({ author: 1, createdAt: -1 })
postSchema.index({ createdAt: -1 })

export default mongoose.model<IPost>('Post', postSchema)
