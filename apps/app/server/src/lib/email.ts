import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'Acumen <hello@acumen.app>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  max-width: 520px; margin: 0 auto; padding: 40px 24px;
  color: #0A0A0B; line-height: 1.6;
`;

const buttonStyle = `
  display: inline-block; background: #0A0A0B; color: #EDF1E7;
  padding: 14px 28px; border-radius: 8px; text-decoration: none;
  font-weight: 600; font-size: 15px; letter-spacing: -0.1px;
`;

function wrapEmail(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /></head>
    <body style="background: #EDF1E7; margin: 0; padding: 40px 16px;">
      <div style="${baseStyles} background: white; border-radius: 14px; border: 1px solid #E7E5E0;">
        <div style="margin-bottom: 32px; display: flex; align-items: center; gap: 10px;">
          <span style="display: inline-block; width: 30px; height: 30px; background: #0A0A0B; border-radius: 7px;"></span>
          <strong style="font-size: 17px; letter-spacing: -0.5px;">Acumen</strong>
        </div>
        ${content}
        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E7E5E0; font-size: 12px; color: #71717A;">
          Acumen — Cambridge exam intelligence for schools.<br/>
          If you didn't expect this email, you can safely ignore it.
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const content = `
    <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -1px; margin: 0 0 12px;">Sign in to Acumen</h1>
    <p style="margin: 0 0 28px; color: #27272A;">Click the button below to sign in. The link expires in 15 minutes.</p>
    <a href="${url}" style="${buttonStyle}">Sign in to Acumen</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #71717A;">Or copy this link: <br/><code style="word-break: break-all; color: #9A3412;">${url}</code></p>
  `;
  return resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your Acumen sign-in link',
    html: wrapEmail(content),
  });
}

export async function sendInviteEmail(args: {
  email: string;
  inviterName: string;
  tenantName: string;
  acceptUrl: string;
}) {
  const content = `
    <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -1px; margin: 0 0 12px;">You're invited to ${args.tenantName}</h1>
    <p style="margin: 0 0 28px; color: #27272A;"><strong>${args.inviterName}</strong> has invited you to join <strong>${args.tenantName}</strong> on Acumen — the exam intelligence platform for Cambridge schools.</p>
    <a href="${args.acceptUrl}" style="${buttonStyle}">Accept invitation</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #71717A;">This invitation expires in 7 days.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: args.email,
    subject: `${args.inviterName} invited you to ${args.tenantName} on Acumen`,
    html: wrapEmail(content),
  });
}

export async function sendContactAckEmail(args: {
  email: string;
  name: string;
}) {
  const content = `
    <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -1px; margin: 0 0 12px;">We got your message</h1>
    <p style="margin: 0 0 24px; color: #27272A;">Hi ${args.name || 'there'} — thanks for reaching out. We've received your message and will reply within one working day.</p>
    <p style="margin: 0; font-size: 13px; color: #71717A;">In the meantime, feel free to explore Acumen — your first upload is always on us.</p>
  `;
  return resend.emails.send({
    from: FROM,
    to: args.email,
    subject: 'We received your message — Acumen',
    html: wrapEmail(content),
  });
}

export async function sendContactNotificationEmail(args: {
  name: string;
  school: string;
  email: string;
  role: string;
  message: string;
}) {
  const TEAM_EMAIL = process.env.TEAM_EMAIL ?? 'hello@acumen.app';
  const content = `
    <h1 style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 20px;">New contact form submission</h1>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr><td style="padding: 8px 0; color: #71717A; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${args.name}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">School</td><td style="padding: 8px 0; font-weight: 600;">${args.school}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">Email</td><td style="padding: 8px 0;"><a href="mailto:${args.email}" style="color: #9A3412;">${args.email}</a></td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">Role</td><td style="padding: 8px 0;">${args.role}</td></tr>
    </table>
    <div style="background: #F9F8F6; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.7; color: #27272A;">
      ${args.message.replace(/\n/g, '<br/>')}
    </div>
  `;
  return resend.emails.send({
    from: FROM,
    to: TEAM_EMAIL,
    replyTo: args.email,
    subject: `Contact: ${args.name} — ${args.school}`,
    html: wrapEmail(content),
  });
}

export async function sendReceiptEmail(args: {
  email: string;
  tenantName: string;
  packName: string;
  uploads: number;
  amount: string;
  reference: string;
}) {
  const content = `
    <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -1px; margin: 0 0 12px;">Payment received</h1>
    <p style="margin: 0 0 24px; color: #27272A;">Thanks — your purchase has been credited to <strong>${args.tenantName}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr><td style="padding: 8px 0; color: #71717A;">Pack</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${args.packName}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">Uploads added</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">+${args.uploads}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${args.amount}</td></tr>
      <tr><td style="padding: 8px 0; color: #71717A;">Reference</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${args.reference}</td></tr>
    </table>
    <a href="${APP_URL}" style="${buttonStyle}">Open Acumen</a>
  `;
  return resend.emails.send({
    from: FROM,
    to: args.email,
    subject: `Receipt for your Acumen purchase — ${args.packName}`,
    html: wrapEmail(content),
  });
}
