import { Router, Request, Response } from 'express'
import User from '../models/User'
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

export default router
