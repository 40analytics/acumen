import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { creditBalances, creditPurchases, creditTransactions } from '../db/schema.js';
import { verifyTransaction, verifyWebhookSignature } from '../lib/paystack.js';
import { sendReceiptEmail } from '../lib/email.js';
import type { AppEnv } from '../middleware/auth.js';

export const paystackWebhookRouter = new Hono<AppEnv>();

/**
 * POST /api/paystack/webhook — Paystack signs each event with HMAC-SHA512
 * We verify the signature, then re-verify the transaction by reference
 * to avoid trusting webhook data alone.
 */
paystackWebhookRouter.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-paystack-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(rawBody) as { event: string; data: { reference: string } };

  if (event.event !== 'charge.success') {
    return c.json({ ok: true, ignored: true });
  }

  const reference = event.data.reference;
  const purchase = await db.query.creditPurchases.findFirst({
    where: eq(creditPurchases.paystackReference, reference),
  });
  if (!purchase) {
    console.warn(`[paystack] Unknown reference: ${reference}`);
    return c.json({ ok: true, unknown: true });
  }
  if (purchase.status === 'success') {
    return c.json({ ok: true, alreadyProcessed: true });
  }

  // Re-verify with Paystack directly (don't trust webhook data alone)
  const verification = await verifyTransaction(reference);
  if (!verification.status || verification.data.status !== 'success') {
    await db
      .update(creditPurchases)
      .set({
        status: 'failed',
        rawResponse: verification as any,
        updatedAt: new Date(),
      })
      .where(eq(creditPurchases.id, purchase.id));
    return c.json({ ok: true, failed: true });
  }

  // Credit the tenant atomically
  await db.transaction(async (tx) => {
    const [updatedBalance] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${purchase.creditsToCredit}`,
        lifetimePurchased: sql`${creditBalances.lifetimePurchased} + ${purchase.creditsToCredit}`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.tenantId, purchase.tenantId))
      .returning({ balance: creditBalances.balance });

    await tx.insert(creditTransactions).values({
      tenantId: purchase.tenantId,
      type: 'purchase',
      amount: purchase.creditsToCredit,
      balanceAfter: updatedBalance.balance,
      purchaseId: purchase.id,
      actorUserId: purchase.initiatedByUserId,
      note: `Credit purchase: ${purchase.packId}`,
    });

    await tx
      .update(creditPurchases)
      .set({
        status: 'success',
        paidAt: new Date(verification.data.paid_at!),
        rawResponse: verification as any,
        updatedAt: new Date(),
      })
      .where(eq(creditPurchases.id, purchase.id));
  });

  return c.json({ ok: true });
});
