// Push Notification Service using Firebase Admin SDK
// Requires FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL env vars
// Or a service account JSON file via FIREBASE_SERVICE_ACCOUNT_PATH

import admin from 'firebase-admin'

let initialized = false

export function initializeFirebase() {
  if (initialized) return

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

    if (projectId && privateKey && clientEmail) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      })
      initialized = true
      console.log('[Push] Firebase Admin initialized')
    } else {
      console.warn('[Push] Firebase credentials not configured. Push notifications disabled.')
    }
  } catch (error: any) {
    console.error('[Push] Failed to initialize Firebase:', error.message)
  }
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!initialized) {
    console.warn('[Push] Firebase not initialized, skipping push notification')
    return false
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    })
    return true
  } catch (error: any) {
    console.error('[Push] Failed to send notification:', error.message)
    // Token might be invalid, remove it
    if (error.code === 'messaging/registration-token-not-registered') {
      return false
    }
    return false
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!initialized) return

  try {
    const User = (await import('../models/User')).default
    const user = await User.findById(userId).select('fcmTokens')
    if (!user) return

    const tokens = (user as any).fcmTokens || []
    if (tokens.length === 0) return

    // Send to all tokens, remove invalid ones
    const results = await Promise.allSettled(
      tokens.map((token: string) => sendPushNotification(token, title, body, data))
    )

    // Remove failed tokens
    const failedTokens: string[] = []
    results.forEach((result, index) => {
      if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)) {
        failedTokens.push(tokens[index])
      }
    })

    if (failedTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { $in: failedTokens } },
      })
    }
  } catch (error: any) {
    console.error('[Push] Error sending to user:', error.message)
  }
}
