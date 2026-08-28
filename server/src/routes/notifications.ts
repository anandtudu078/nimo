import { Router, Response } from 'express'
import Notification from '../models/Notification'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all notifications
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Notification.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('from', 'username displayName avatar')
      .populate('post', 'content')

    res.json({ notifications })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch notifications' })
  }
})

// Mark notification as read
router.put('/:id/read', auth, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true })
    res.json({ message: 'Notification marked as read' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark notification as read' })
  }
})

// Mark all as read
router.put('/read-all', auth, async (req: AuthRequest, res: Response) => {
  try {
    await Notification.updateMany({ user: req.userId, read: false }, { read: true })
    res.json({ message: 'All notifications marked as read' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to mark notifications as read' })
  }
})

export default router
