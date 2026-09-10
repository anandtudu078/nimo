import { NextFunction, Response } from 'express'
import User from '../models/User'
import { AuthRequest } from '../middleware/auth'

// Admin gate: ADMIN_USERNAMES is a comma-separated allowlist of usernames.
// (The app has no role field on User; an env allowlist is the simplest
// production-safe option — set e.g. ADMIN_USERNAMES=alice,bob)
// With no ADMIN_USERNAMES configured, no one passes and admin routes are closed.
export const adminAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId).select('username')
    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    const admins = (process.env.ADMIN_USERNAMES || '')
      .split(',')
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean)

    if (admins.length === 0 || !admins.includes(user.username.toLowerCase())) {
      return res.status(403).json({ message: 'Admin access required' })
    }

    next()
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Authorization check failed' })
  }
}
