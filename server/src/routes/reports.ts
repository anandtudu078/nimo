import { Router, Response } from 'express'
import Report from '../models/Report'
import { auth, AuthRequest } from '../middleware/auth'

const router = Router()

// Report a post or user
router.post('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason, description } = req.body

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ message: 'targetType, targetId, and reason are required' })
    }

    if (!['post', 'user'].includes(targetType)) {
      return res.status(400).json({ message: 'targetType must be post or user' })
    }

    // Check for duplicate report
    const existing = await Report.findOne({
      reporter: req.userId,
      targetType,
      targetId,
    })
    if (existing) {
      return res.status(409).json({ message: 'You have already reported this' })
    }

    const report = new Report({
      reporter: req.userId,
      targetType,
      targetId,
      reason,
      description,
    })
    await report.save()

    res.status(201).json({ message: 'Report submitted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to submit report' })
  }
})

// Get all reports (admin)
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate('reporter', 'username displayName')
    res.json({ reports })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch reports' })
  }
})

// Update report status (admin)
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { status }, { new: true })
    if (!report) return res.status(404).json({ message: 'Report not found' })
    res.json({ report })
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update report' })
  }
})

export default router
