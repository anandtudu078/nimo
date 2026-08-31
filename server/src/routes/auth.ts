import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import User from '../models/User'
import PasswordReset from '../models/PasswordReset'
import { auth, AuthRequest, generateToken } from '../middleware/auth'

const router = Router()

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, displayName, email, password } = req.body

    const existingUser = await User.findOne({ $or: [{ email }, { username }] })
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken',
      })
    }

    const user = new User({ username, displayName, email, password })
    await user.save()

    const token = generateToken(user._id.toString())
    res.status(201).json({ token, user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to register' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const token = generateToken(user._id.toString())
    res.json({ token, user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to login' })
  }
})

// Get current user
router.get('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.json({ user })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get user' })
  }
})

// Forgot password - generate reset token
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
    }

    // Invalidate any existing tokens for this user
    await PasswordReset.deleteMany({ user: user._id })

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await PasswordReset.create({
      user: user._id,
      token,
      expiresAt,
    })

    // TODO: Send email with reset link
    // For now, log the reset URL to console
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`
    console.log(`[Password Reset] ${user.email}: ${resetUrl}`)

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to process request' })
  }
})

// Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const resetRecord = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    })

    if (!resetRecord) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }

    // Update password
    const user = await User.findById(resetRecord.user)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    user.password = password
    await user.save()

    // Mark token as used
    resetRecord.used = true
    await resetRecord.save()

    res.json({ message: 'Password reset successful' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to reset password' })
  }
})

export default router
