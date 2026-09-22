import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'

type VerifyState = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [state, setState] = useState<VerifyState>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('This verification link is invalid or missing a token.')
      return
    }
    let cancelled = false
    api
      .post('/email-verification/verify', { token })
      .then((res) => {
        if (cancelled) return
        setState('success')
        setMessage(res.data?.message || 'Email verified successfully')
      })
      .catch((err: any) => {
        if (cancelled) return
        setState('error')
        setMessage(err?.response?.data?.message || 'Failed to verify email')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Nimo</h1>
        <div className="bg-black border border-gray-800 rounded-2xl p-8">
          {state === 'verifying' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Verifying your email...</h2>
              <div className="flex justify-center">
                <span className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            </>
          )}
          {state === 'success' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Email verified ✅</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link to="/feed" className="btn-primary inline-block">
                Go to Feed
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <h2 className="text-xl font-bold text-white mb-4">Verification failed</h2>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link to="/settings" className="btn-primary inline-block">
                Go to Settings
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
