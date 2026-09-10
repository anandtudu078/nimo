import jwt from 'jsonwebtoken'

// Single source of truth for the JWT secret — used by the auth middleware,
// socket.io handshake, and anywhere else tokens are verified.

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Guessable default tokens = full account takeover. Refuse to boot.
    console.error('❌ FATAL: JWT_SECRET must be set in production. Refusing to start with an insecure default.')
    process.exit(1)
  }
  console.warn('⚠️  WARNING: JWT_SECRET not set! Using insecure dev default. Set JWT_SECRET in your environment variables.')
}

export function getJwtSecret(): string {
  return JWT_SECRET || 'dev-only-insecure-secret-change-me'
}

export function signToken(
  payload: { userId: string },
  expiresIn: jwt.SignOptions['expiresIn'] = '7d'
): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string }
  } catch {
    return null
  }
}
