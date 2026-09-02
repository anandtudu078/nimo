import crypto from 'crypto'
import { Router, Response } from 'express'
import EmailVerification from '../models/EmailVerification'
import User from '../models/User'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Send verification email
router.post('/send', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (user.emailVerified) {
      return res.json({ message: 'Email already verified' })
    }

    // Invalidate existing tokens
    await EmailVerification.deleteMany({ user: req.userId })

    // Generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await EmailVerification.create({
      user: req.userId,
      token,
      expiresAt,
    })

    // TODO: Send verification email
    // For now, log the verification URL
    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${token}`
    console.log(`[Email Verification] ${user.email}: ${verifyUrl}`)

    res.json({ message: 'Verification email sent' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send verification email' })
  }
})

// Verify email with token
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ message: 'Token is required' })

    const verification = await EmailVerification.findOne({
      token,
      verified: false,
      expiresAt: { $gt: new Date() },
    })

    if (!verification) {
      return res.status(400).json({ message: 'Invalid or expired verification token' })
    }

    // Mark email as verified
    await User.findByIdAndUpdate(verification.user, { emailVerified: true })

    // Mark token as used
    verification.verified = true
    await verification.save()

    res.json({ message: 'Email verified successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to verify email' })
  }
})

// Check verification status
router.get('/status', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('email emailVerified')
    if (!user) return res.status(404).json({ message: 'User not found' })

    res.json({
      email: user.email,
      verified: user.emailVerified,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get verification status' })
  }
})

export default router
