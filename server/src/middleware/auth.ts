import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set! Using insecure default. Set JWT_SECRET in your environment variables.')
}

export interface AuthRequest extends Request {
  userId?: string
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}
