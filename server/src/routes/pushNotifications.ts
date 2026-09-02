import { Router, Response } from 'express'
import User from '../models/User'
import { auth, AuthRequest } from '../middleware/auth'
import { sendPushNotification, sendPushToUser } from '../config/pushNotifications'

const router = Router()

// Register FCM token for push notifications
router.post('/register', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform } = req.body // platform: 'ios' | 'android' | 'web'

    if (!token) {
      return res.status(400).json({ message: 'FCM token is required' })
    }

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Add token if not already present
    const fcmTokens = (user as any).fcmTokens || []
    if (!fcmTokens.includes(token)) {
      fcmTokens.push(token)
      ;(user as any).fcmTokens = fcmTokens
      await user.save()
    }

    res.json({ message: 'Push notification token registered' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to register token' })
  }
})

// Unregister FCM token
router.post('/unregister', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body
    if (!token) return res.status(400).json({ message: 'FCM token is required' })

    await User.findByIdAndUpdate(req.userId, {
      $pull: { fcmTokens: token },
    })

    res.json({ message: 'Push notification token unregistered' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to unregister token' })
  }
})

// Send test notification (for debugging)
router.post('/test', auth, async (req: AuthRequest, res: Response) => {
  try {
    const success = await sendPushToUser(
      req.userId,
      'Test Notification',
      'Push notifications are working! 🎉',
      { type: 'test' }
    )

    res.json({ message: 'Test notification sent', success })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send test notification' })
  }
})

export default router
