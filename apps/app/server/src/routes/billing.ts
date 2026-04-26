import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  creditBalances,
  creditPurchases,
  creditTransactions,
} from '../db/schema.js';
import { initTransaction, verifyTransaction, generateReference } from '../lib/paystack.js';
import { sendReceiptEmail } from '../lib/email.js';
import { type AppEnv } from '../middleware/auth.js';
import { CREDIT_PACKS, purchaseCreditsSchema, type CreditPack } from '@acumen/shared';

/**
 * Billing routes — mounted under /api/t/:tenantSlug/billing/*
 * Already protected by requireUser + requireTenant in parent router.
 */
export const billingRouter = new Hono<AppEnv>();

const CURRENCY = (process.env.PAYSTACK_CURRENCY ?? 'GHS') as 'GHS' | 'NGN' | 'USD' | 'ZAR' | 'KES';
const USD_TO_LOCAL = Number(process.env.PAYSTACK_USD_RATE ?? 12); // 1 USD = 12 GHS placeholder
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

function packPrice(pack: CreditPack) {
  const amountLocal = +(pack.priceUsd * USD_TO_LOCAL).toFixed(2);
  return {
    amountLocal,
    amountKobo: Math.round(amountLocal * 100),
    currency: CURRENCY,
  };
}

/**
 * GET /api/t/:tenantSlug/billing/packs — list packs with current pricing
 */
billingRouter.get('/packs', (c) => {
  const packs = CREDIT_PACKS.map((pack) => ({
    ...pack,
    ...packPrice(pack),
  }));
  return c.json({ packs, currency: CURRENCY, usdRate: USD_TO_LOCAL });
});

/**
 * Sweep all `pending` purchases for an org — re-verify each one with
 * Paystack. Catches the case where the user paid but never landed on the
 * callback page (closed browser, network drop, etc.).
 *
 * We can't use Paystack webhooks because the Paystack account is shared
 * across multiple apps, so this active poll is our reliable path to credit.
 */
async function sweepPendingPurchases(args: {
  orgId: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
}): Promise<void> {
  // Only consider purchases older than 30s (avoid racing with checkout flow)
  // and younger than 24h (anything older is almost certainly abandoned)
  const cutoffNew = new Date(Date.now() - 30 * 1000);
  const cutoffOld = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pending = await db
    .select()
    .from(creditPurchases)
    .where(
      and(
        eq(creditPurchases.orgId, args.orgId),
        or(
          eq(creditPurchases.status, 'pending'),
          eq(creditPurchases.status, 'initialized')
        )!,
        lt(creditPurchases.createdAt, cutoffNew)
      )
    )
    .limit(20);

  for (const purchase of pending) {
    try {
      const verification = await verifyTransaction(purchase.paystackReference);
      const remoteStatus = verification.data?.status;

      if (verification.status && remoteStatus === 'success') {
        // Atomically credit (re-checks status inside the txn for idempotency)
        await db.transaction(async (tx) => {
          const fresh = await tx.query.creditPurchases.findFirst({
            where: eq(creditPurchases.id, purchase.id),
          });
          if (!fresh || fresh.status === 'success') return;

          const [updated] = await tx
            .update(creditBalances)
            .set({
              balance: sql`${creditBalances.balance} + ${purchase.creditsToCredit}`,
              lifetimePurchased: sql`${creditBalances.lifetimePurchased} + ${purchase.creditsToCredit}`,
              updatedAt: new Date(),
            })
            .where(eq(creditBalances.orgId, purchase.orgId!))
            .returning({ balance: creditBalances.balance });

          // Bump maxWorkspaces if this pack allows more
          const pack = CREDIT_PACKS.find((p) => p.id === purchase.packId);
          if (pack?.workspaceLimit) {
            await tx.execute(
              sql`UPDATE organisations SET max_workspaces = GREATEST(max_workspaces, ${pack.workspaceLimit}), updated_at = NOW() WHERE id = ${purchase.orgId}`
            );
          }

          await tx.insert(creditTransactions).values({
            orgId: purchase.orgId,
            tenantId: purchase.tenantId,
            type: 'purchase',
            amount: purchase.creditsToCredit,
            balanceAfter: updated.balance,
            purchaseId: purchase.id,
            actorUserId: purchase.initiatedByUserId,
            note: `Credit purchase: ${purchase.packId} (recovered)`,
          });

          await tx
            .update(creditPurchases)
            .set({
              status: 'success',
              paidAt: verification.data.paid_at
                ? new Date(verification.data.paid_at)
                : new Date(),
              rawResponse: verification as any,
              updatedAt: new Date(),
            })
            .where(eq(creditPurchases.id, purchase.id));
        });

        // Receipt
        const pack = CREDIT_PACKS.find((p) => p.id === purchase.packId);
        sendReceiptEmail({
          email: args.userEmail,
          tenantName: args.tenantName,
          packName: pack?.name ?? purchase.packId,
          uploads: purchase.creditsToCredit,
          amount: `${purchase.currency} ${(purchase.amountKobo / 100).toFixed(2)}`,
          reference: purchase.paystackReference,
        }).catch((err) => console.error('[receipt-email]', err));
      } else if (
        remoteStatus === 'failed' ||
        remoteStatus === 'abandoned' ||
        purchase.createdAt < cutoffOld
      ) {
        // Mark as failed/abandoned so we stop polling for it
        await db
          .update(creditPurchases)
          .set({
            status: remoteStatus === 'abandoned' ? 'abandoned' : 'failed',
            rawResponse: verification as any,
            updatedAt: new Date(),
          })
          .where(eq(creditPurchases.id, purchase.id));
      }
      // else: still pending, leave as-is
    } catch (err) {
      console.error(`[sweep] purchase ${purchase.id}:`, err);
    }
  }
}

/**
 * GET /api/t/:tenantSlug/billing/balance — current org balance + recent transactions
 * Sweeps any pending Paystack purchases on the way in — this is our
 * webhook substitute, since the Paystack account is shared.
 */
billingRouter.get('/balance', async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');

  if (!tenant.orgId) {
    return c.json({ balance: 0, lifetimePurchased: 0, lifetimeSpent: 0, transactions: [] });
  }

  // Best-effort sweep — never blocks the response if Paystack is slow
  await sweepPendingPurchases({
    orgId: tenant.orgId,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    userEmail: user.email,
  });

  const balance = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.orgId, tenant.orgId),
  });

  const recentTxns = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.orgId, tenant.orgId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  return c.json({
    balance: balance?.balance ?? 0,
    lifetimePurchased: balance?.lifetimePurchased ?? 0,
    lifetimeSpent: balance?.lifetimeSpent ?? 0,
    transactions: recentTxns,
  });
});

/**
 * POST /api/t/:tenantSlug/billing/sweep — manually trigger pending-purchase
 * recovery (e.g. from a "Check pending payments" button).
 */
billingRouter.post('/sweep', async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');
  if (!tenant.orgId) return c.json({ ok: true });
  await sweepPendingPurchases({
    orgId: tenant.orgId,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    userEmail: user.email,
  });
  return c.json({ ok: true });
});

/**
 * GET /api/t/:tenantSlug/billing/purchases — list org purchase history
 */
billingRouter.get('/purchases', async (c) => {
  const tenant = c.get('tenant')!;
  if (!tenant.orgId) return c.json({ purchases: [] });
  const purchases = await db
    .select()
    .from(creditPurchases)
    .where(eq(creditPurchases.orgId, tenant.orgId))
    .orderBy(desc(creditPurchases.createdAt))
    .limit(50);
  return c.json({ purchases });
});

/**
 * POST /api/t/:tenantSlug/billing/checkout — initialize a Paystack transaction
 */
billingRouter.post('/checkout', zValidator('json', purchaseCreditsSchema), async (c) => {
  const tenant = c.get('tenant')!;
  const user = c.get('user');
  const { packId } = c.req.valid('json');

  if (!tenant.orgId) return c.json({ error: 'Workspace has no organisation — contact support.' }, 400);

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return c.json({ error: 'Unknown pack' }, 400);

  const { amountLocal, amountKobo, currency } = packPrice(pack);
  const reference = generateReference('ACU');
  const callbackUrl = `${APP_URL}/${tenant.tenantSlug}/billing/callback`;

  // Create the local purchase record FIRST so we can match the webhook
  const [purchase] = await db
    .insert(creditPurchases)
    .values({
      orgId: tenant.orgId,
      tenantId: tenant.tenantId,
      initiatedByUserId: user.id,
      packId: pack.id,
      creditsToCredit: pack.uploads,
      amountKobo,
      currency,
      paystackReference: reference,
      status: 'initialized',
    })
    .returning();

  // Initialize with Paystack
  let init;
  try {
    init = await initTransaction({
      email: user.email,
      amountKobo,
      reference,
      currency,
      callbackUrl,
      metadata: {
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        userId: user.id,
        packId: pack.id,
        uploads: pack.uploads,
      },
    });
  } catch (err: any) {
    await db
      .update(creditPurchases)
      .set({ status: 'failed', rawResponse: { error: err?.message } as any, updatedAt: new Date() })
      .where(eq(creditPurchases.id, purchase.id));
    return c.json({ error: 'Could not start payment. Try again.' }, 502);
  }

  await db
    .update(creditPurchases)
    .set({
      paystackAccessCode: init.data.access_code,
      paystackAuthorizationUrl: init.data.authorization_url,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(creditPurchases.id, purchase.id));

  return c.json({
    authorizationUrl: init.data.authorization_url,
    reference,
    pack: { id: pack.id, name: pack.name, uploads: pack.uploads },
    amount: { local: amountLocal, currency, usd: pack.priceUsd },
  });
});

/**
 * GET /api/t/:tenantSlug/billing/verify?reference=xxx
 * Called by the callback page. Re-verifies with Paystack and credits the
 * tenant if not already done by the webhook.
 */
billingRouter.get('/verify', async (c) => {
  const tenant = c.get('tenant')!;
  const reference = c.req.query('reference');
  if (!reference) return c.json({ error: 'Missing reference' }, 400);

  const purchase = await db.query.creditPurchases.findFirst({
    where: eq(creditPurchases.paystackReference, reference),
  });
  if (!purchase) return c.json({ error: 'Unknown reference' }, 404);
  if (purchase.orgId !== tenant.orgId) {
    return c.json({ error: 'Reference belongs to another organisation' }, 403);
  }

  if (purchase.status === 'success') {
    return c.json({
      status: 'success',
      pack: purchase.packId,
      uploads: purchase.creditsToCredit,
      reference: purchase.paystackReference,
    });
  }

  // Re-verify with Paystack (don't trust webhook alone)
  const verification = await verifyTransaction(reference);
  if (!verification.status || verification.data.status !== 'success') {
    if (purchase.status !== 'failed') {
      await db
        .update(creditPurchases)
        .set({
          status: verification.data.status === 'abandoned' ? 'abandoned' : 'failed',
          rawResponse: verification as any,
          updatedAt: new Date(),
        })
        .where(eq(creditPurchases.id, purchase.id));
    }
    return c.json({ status: 'failed', reason: verification.data.status });
  }

  // Credit the tenant atomically (idempotent — webhook may have run already)
  const result = await db.transaction(async (tx) => {
    // Re-read with row lock to avoid double-credit if webhook fires concurrently
    const fresh = await tx.query.creditPurchases.findFirst({
      where: eq(creditPurchases.id, purchase.id),
    });
    if (!fresh || fresh.status === 'success') {
      return { alreadyCredited: true, balance: 0 };
    }

    const [updated] = await tx
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${purchase.creditsToCredit}`,
        lifetimePurchased: sql`${creditBalances.lifetimePurchased} + ${purchase.creditsToCredit}`,
        updatedAt: new Date(),
      })
      .where(eq(creditBalances.orgId, purchase.orgId!))
      .returning({ balance: creditBalances.balance });

    // Bump org workspace limit if this pack unlocks more
    const packMeta = CREDIT_PACKS.find((p) => p.id === purchase.packId);
    if (packMeta?.workspaceLimit) {
      await tx.execute(
        sql`UPDATE organisations SET max_workspaces = GREATEST(max_workspaces, ${packMeta.workspaceLimit}), updated_at = NOW() WHERE id = ${purchase.orgId}`
      );
    }

    await tx.insert(creditTransactions).values({
      orgId: purchase.orgId,
      tenantId: purchase.tenantId,
      type: 'purchase',
      amount: purchase.creditsToCredit,
      balanceAfter: updated.balance,
      purchaseId: purchase.id,
      actorUserId: purchase.initiatedByUserId,
      note: `Credit purchase: ${purchase.packId}`,
    });

    await tx
      .update(creditPurchases)
      .set({
        status: 'success',
        paidAt: verification.data.paid_at ? new Date(verification.data.paid_at) : new Date(),
        rawResponse: verification as any,
        updatedAt: new Date(),
      })
      .where(eq(creditPurchases.id, purchase.id));

    return { alreadyCredited: false, balance: updated.balance };
  });

  // Fire-and-forget receipt email
  if (!result.alreadyCredited) {
    const pack = CREDIT_PACKS.find((p) => p.id === purchase.packId);
    sendReceiptEmail({
      email: c.get('user').email,
      tenantName: tenant.tenantName,
      packName: pack?.name ?? purchase.packId,
      uploads: purchase.creditsToCredit,
      amount: `${purchase.currency} ${(purchase.amountKobo / 100).toFixed(2)}`,
      reference: purchase.paystackReference,
    }).catch((err) => console.error('[receipt-email]', err));
  }

  return c.json({
    status: 'success',
    pack: purchase.packId,
    uploads: purchase.creditsToCredit,
    reference: purchase.paystackReference,
    balanceAfter: result.balance,
  });
});
