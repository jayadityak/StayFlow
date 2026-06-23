import { Resend } from 'resend';

const FROM = 'StayFlow <noreply@stayflow.in>';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping password reset email');
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset your StayFlow password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0F172A">Reset your password</h2>
        <p>Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4F6EF7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#64748b;font-size:13px">If you didn't request this, ignore this email — your password won't change.</p>
      </div>
    `,
  });
}

export async function sendStaffNotificationEmail(
  email: string,
  hotelName: string,
  type: string,
  roomNumber: string,
  details: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `[${hotelName}] New ${type} — Room ${roomNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h3 style="color:#0F172A">New ${type} · Room ${roomNumber}</h3>
        <p>${details}</p>
        <p style="color:#64748b;font-size:13px">Log in to StayFlow to action this request.</p>
      </div>
    `,
  });
}
