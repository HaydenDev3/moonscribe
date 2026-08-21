import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY || ''
const fromAddress = process.env.RESEND_FROM_EMAIL || 'MoonScribe <noreply@moonscribe.app>'
const resend = apiKey ? new Resend(apiKey) : null

export function isEmailConfigured() {
  return Boolean(resend)
}

export async function sendTransactionalEmail({ to, subject, text, html }) {
  if (!resend) {
    return { ok: false, reason: 'EMAIL_NOT_CONFIGURED' }
  }

  try {
    const recipients = Array.isArray(to) ? to : [to]
    const response = await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject,
      text,
      html: html || text,
    })

    if (response && response.error) {
      return { ok: false, error: response.error, reason: 'EMAIL_SEND_FAILED' }
    }

    return { ok: true, response }
  } catch (error) {
    return { ok: false, error, reason: 'EMAIL_SEND_FAILED' }
  }
}

export async function sendVerificationCode({ to, username, code, appOrigin }) {
  const origin = appOrigin || 'https://app.moonscribe.app'
  return sendTransactionalEmail({
    to,
    subject: 'Verify your MoonScribe account',
    text: `Hi ${username || 'writer'},\n\nYour MoonScribe verification code is ${code}. Enter it in the app to confirm your email.\n\n${origin}`,
    html: `<div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px"><h2 style="margin:0 0 12px;color:#111827">Verify your MoonScribe account</h2><p style="margin:0 0 16px;color:#475569">Hi ${username || 'writer'},</p><p style="margin:0 0 18px;color:#475569">Use this code to verify your email and unlock your account:</p><div style="display:inline-block;padding:14px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#1d4ed8">${code}</div><p style="margin-top:18px;color:#475569">This code expires soon. If you did not request this, you can ignore it.</p><p style="margin-top:20px;color:#64748b">${origin}</p></div></div>`,
  })
}

export async function sendTwoFactorCode({ to, username, code }) {
  return sendTransactionalEmail({
    to,
    subject: 'Your MoonScribe security code',
    text: `Hi ${username || 'writer'},\n\nYour MoonScribe security code is ${code}. Enter it to continue.`,
    html: `<div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px"><h2 style="margin:0 0 12px;color:#111827">Your security code</h2><p style="margin:0 0 16px;color:#475569">Hi ${username || 'writer'},</p><p style="margin:0 0 18px;color:#475569">Use this code to complete your login:</p><div style="display:inline-block;padding:14px 18px;background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#92400e">${code}</div><p style="margin-top:18px;color:#475569">This code expires soon. If you did not request this, review your account security.</p></div></div>`,
  })
}

export async function sendAccountUpdateEmail({ to, username, summary }) {
  return sendTransactionalEmail({
    to,
    subject: 'MoonScribe account update',
    text: `Hi ${username || 'writer'},\n\n${summary}`,
    html: `<div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px"><h2 style="margin:0 0 12px;color:#111827">Account update</h2><p style="margin:0 0 14px;color:#475569">Hi ${username || 'writer'},</p><p style="margin:0;color:#475569">${summary}</p></div></div>`,
  })
}

export async function sendReminderEmail({ to, username, title, message }) {
  return sendTransactionalEmail({
    to,
    subject: title,
    text: `Hi ${username || 'writer'},\n\n${message}`,
    html: `<div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px"><h2 style="margin:0 0 12px;color:#111827">${title}</h2><p style="margin:0;color:#475569">Hi ${username || 'writer'},</p><p style="margin-top:16px;color:#475569">${message}</p></div></div>`,
  })
}
