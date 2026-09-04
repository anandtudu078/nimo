export interface User {
  _id: string
  username: string
  displayName: string
  email: string
  avatar?: string
  bio?: string
  website?: string
  studyYear?: string
  followers: string[]
  following: string[]
  createdAt: string
}

export interface Comment {
  _id: string
  author: {
    _id: string
    username: string
    displayName: string
    avatar?: string
  }
  content: string
  createdAt: string
}

export interface Post {
  _id: string
  author: {
    _id: string
    username: string
    displayName: string
    avatar?: string
  }
  content: string
  images: string[]
  likes: string[]
  comments: Comment[]
  createdAt: string
}

export interface ConversationParticipant {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

export type ReactionEmoji = '❤️' | '🔥' | '😂' | '😮' | '😢' | '👍'

export interface ReactionUser {
  _id: string
  username: string
  displayName: string
  avatar?: string
}

// GET /reactions/:postId returns a map of emoji -> users who reacted
export type ReactionGroups = Record<string, ReactionUser[]>
