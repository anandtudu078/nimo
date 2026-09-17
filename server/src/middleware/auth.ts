import { Request, Response, NextFunction } from 'express'
import User from '../models/User'
import { signToken, verifyToken } from '../config/jwt'

export interface AuthRequest extends Request {
  userId?: string
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' })
    }
    const user = await User.findById(decoded.userId).select('+tokenVersion')
    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    // Token versioning: bumping user.tokenVersion (on password change/reset)
    // instantly invalidates every previously issued token for that account.
    // Tokens issued before versioning existed carry no `ver` claim; treat
    // undefined as 0 so they still validate against version 0.
    const tokenVer = decoded.ver ?? 0
    if (tokenVer !== (user as any).tokenVersion) {
      return res.status(401).json({ message: 'Session expired, please log in again' })
    }

    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

export const generateToken = (userId: string, tokenVersion = 0): string => {
  return signToken({ userId, ver: tokenVersion })
}
