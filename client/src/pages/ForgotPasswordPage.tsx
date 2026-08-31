import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Nimo</h1>
          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-4">Check your email</h2>
            <p className="text-gray-400 mb-6">
              If an account exists with <span className="text-white">{email}</span>, we've sent a password reset link.
            </p>
            <Link to="/login" className="btn-primary inline-block">
              Back to Sign In
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
          <p className="text-gray-500 mt-2">Reset your password</p>
        </div>

        <div className="bg-black border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 text-center text-white">Forgot your password?</h2>
          <p className="text-gray-500 text-center mb-6 text-sm">
            Enter your email and we'll send you a reset link.
          </p>

          {error && (
            <div className="bg-red-950/50 text-red-400 border border-red-900 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="text-center mt-6 text-gray-500">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-500 hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
