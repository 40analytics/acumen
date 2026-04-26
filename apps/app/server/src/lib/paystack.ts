import crypto from 'node:crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY ?? '';

if (!PAYSTACK_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[paystack] PAYSTACK_SECRET_KEY is not set');
}

interface InitTransactionArgs {
  email: string;
  amountKobo: number;
  reference: string;
  currency?: 'GHS' | 'NGN' | 'USD' | 'ZAR' | 'KES';
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

interface InitTransactionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    customer: { email: string };
    metadata: Record<string, unknown>;
  };
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Paystack ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

export async function initTransaction(args: InitTransactionArgs) {
  return paystackFetch<InitTransactionResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      currency: args.currency ?? 'GHS',
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string) {
  return paystackFetch<VerifyTransactionResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
}

export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature || !PAYSTACK_SECRET) return false;
  const computed = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export function generateReference(prefix = 'ACU'): string {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${Date.now()}_${random}`;
}
