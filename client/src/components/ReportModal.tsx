import { useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import api from '../services/api'

interface ReportModalProps {
  targetType: 'post' | 'user'
  targetId: string
  onClose: () => void
}

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or dangerous content' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'copyright', label: 'Copyright infringement' },
  { value: 'other', label: 'Other' },
]

export default function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/reports', { targetType, targetId, reason, description })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black border border-gray-700 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Report {targetType === 'post' ? 'Post' : 'User'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <FaTimes size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center">
            <p className="text-green-400 font-medium mb-2">Report submitted</p>
            <p className="text-sm text-gray-500 mb-4">Thank you for helping keep Nimo safe. We'll review your report.</p>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div>
              <p className="text-sm font-medium text-gray-400 mb-2">Why are you reporting this?</p>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-gray-300">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Additional details (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide more context..."
                className="input-field text-sm resize-none"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !reason}
                className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
