import nodemailer, { type Transporter } from 'nodemailer'

// ---------------------------------------------------------------------------
// SMTP configuration
// ---------------------------------------------------------------------------
// Configure via env vars in server/.env (or your hosting dashboard):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=your-app-password
//   MAIL_FROM="Nimo <no-reply@nimo.app>"
//
// When SMTP_* vars are absent (local dev), emails are logged to the console
// instead of being sent, so auth flows keep working without credentials.

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const MAIL_FROM =
  process.env.MAIL_FROM || `Nimo <no-reply@${SMTP_HOST || 'nimo.local'}>`

const isSmtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS)

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!isSmtpConfigured) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for 587/25 (STARTTLS)
      auth: { user: SMTP_USER!, pass: SMTP_PASS! },
    })
  }
  return transporter
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

const BRAND_COLOR = '#6366f1' // indigo-500, matches Nimo's dark aesthetic

function wrapTemplate(title: string, bodyHtml: string, ctaUrl: string, ctaLabel: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#1e293b;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:20px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;">🌟 Nimo</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:18px;">${title}</h2>
                <p style="margin:0 0 24px;color:#cbd5e1;font-size:14px;line-height:1.6;">${bodyHtml}</p>
                <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${ctaLabel}</a>
                <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                  If the button doesn't work, copy this link into your browser:<br />
                  <a href="${ctaUrl}" style="color:#818cf8;word-break:break-all;">${ctaUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#0f172a;padding:16px 32px;text-align:center;">
                <p style="margin:0;color:#475569;font-size:11px;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * Send an email via SMTP, or log it to the console when SMTP is not
 * configured. Never throws — email failures must not break auth flows;
 * they are logged so they can be diagnosed from server output.
 */
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const transport = getTransporter()
  if (!transport) {
    console.log(
      `[Mailer] SMTP not configured — email not sent. Subject: "${subject}" | To: ${to}`
    )
    return false
  }
  try {
    await transport.sendMail({ from: MAIL_FROM, to, subject, html })
    return true
  } catch (error: any) {
    console.error(`[Mailer] Failed to send "${subject}" to ${to}:`, error.message)
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<boolean> {
  const html = wrapTemplate(
    'Reset your password',
    'We received a request to reset your Nimo password. This link is valid for <strong>1 hour</strong>. Click below to choose a new password.',
    resetUrl,
    'Reset Password'
  )
  return sendMail(to, 'Reset your Nimo password', html)
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string
): Promise<boolean> {
  const html = wrapTemplate(
    'Verify your email',
    'Welcome to Nimo! Confirm your email address to unlock your account. This link is valid for <strong>24 hours</strong>.',
    verifyUrl,
    'Verify Email'
  )
  return sendMail(to, 'Verify your Nimo email', html)
}
