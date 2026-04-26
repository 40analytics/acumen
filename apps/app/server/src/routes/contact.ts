import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sendContactAckEmail, sendContactNotificationEmail } from '../lib/email.js';

export const contactRouter = new Hono();

const contactSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  school: z.string().min(1).max(120).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.string().min(1).max(80).trim(),
  message: z.string().min(1).max(2000).trim(),
});

contactRouter.post('/', zValidator('json', contactSchema), async (c) => {
  const input = c.req.valid('json');

  // Fire both emails concurrently; don't let a Resend failure 500 the request
  await Promise.allSettled([
    sendContactAckEmail({ email: input.email, name: input.name }),
    sendContactNotificationEmail({
      name: input.name,
      school: input.school,
      email: input.email,
      role: input.role,
      message: input.message,
    }),
  ]);

  return c.json({ ok: true });
});
