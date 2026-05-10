import { BrevoClient } from '@getbrevo/brevo';
import { ENV } from '../config/env';
const brevo = new BrevoClient({ apiKey: ENV.BREVO_API_KEY });

const OPT_Template = (resetToken: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:40px 0;">
  <tr>
    <td align="center">

      <!-- Email Card -->
      <table width="520" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:10px;padding:40px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <h1 style="margin:0;font-size:22px;color:#333333;">
              Password Reset Request
            </h1>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="color:#555555;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px 0;">
              You requested a password reset for your account.
            </p>

            <p style="margin:0 0 24px 0;">
              Please use the following 6-digit code to reset your password:
            </p>
          </td>
        </tr>

        <!-- Code Box -->
        <tr>
          <td align="center" style="padding:10px 0 30px 0;">
            <div style="
              display:inline-block;
              background:#f2f4f7;
              padding:14px 26px;
              font-size:28px;
              font-weight:bold;
              letter-spacing:6px;
              color:#222;
              border-radius:8px;
              border:1px solid #e5e7eb;
            ">
              ${resetToken}
            </div>
          </td>
        </tr>

        <!-- Footer Text -->
        <tr>
          <td style="color:#777777;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 12px 0;">
              This code will expire in <strong>1 hour</strong>.
            </p>

            <p style="margin:0;">
              If you did not request this password reset, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-top:30px;">
            <hr style="border:none;border-top:1px solid #eeeeee;">
          </td>
        </tr>

        <!-- Bottom Note -->
        <tr>
          <td align="center" style="padding-top:10px;color:#9aa0a6;font-size:12px;">
            © 2026 Your Company. All rights reserved.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`

export const sendResetPasswordEmail = async (to: string, resetToken: string) => {
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: to }],
    sender: {  
      name: 'Faizan from WorkPulse',
      email: 'workpulse12@gmail.com'
    },
    subject: 'Password Reset Code',
    htmlContent: OPT_Template(resetToken)
  });
};
export const sendBasicEmail = async (to: string, subject: string, htmlContent: string) => {
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: to }],
    sender: {
      name: 'Faizan from WorkPulse',
      email: 'workpulse12@gmail.com'
    },
    subject,
    htmlContent
  });
};