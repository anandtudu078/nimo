import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Nimo</h1>
          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-4">Invalid Reset Link</h2>
            <p className="text-gray-400 mb-6">This password reset link is invalid or missing a token.</p>
            <Link to="/forgot-password" className="btn-primary inline-block">
              Request a New Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Nimo</h1>
          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-4">Password Reset! ✅</h2>
            <p className="text-gray-400 mb-6">Your password has been updated. Redirecting to sign in...</p>
            <Link to="/login" className="btn-primary inline-block">
              Sign In Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">Nimo</h1>
          <p className="text-gray-500 mt-2">Set your new password</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-white">Reset Password</h2>

          {error && (
            <div className="bg-red-950/50 text-red-400 border border-red-900 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p className="text-center mt-6 text-gray-500">
            <Link to="/login" className="text-blue-500 hover:underline font-medium">
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
