import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiClient, ApiError } from '@/lib/api';
import { Check, Wallet, ArrowDownToLine, Receipt, Info, Lock } from 'lucide-react';

interface Pack {
  id: 'payg' | 'starter' | 'school' | 'institution';
  name: string;
  uploads: number;
  priceUsd: number;
  perUploadUsd: number;
  popular?: boolean;
  amountLocal: number;
  amountKobo: number;
  currency: string;
}

interface PacksResponse {
  packs: Pack[];
  currency: string;
  usdRate: number;
}

interface BalanceResponse {
  balance: number;
  lifetimePurchased: number;
  lifetimeSpent: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    note: string | null;
    createdAt: string;
  }>;
}

const FEATURES: Record<Pack['id'], string[]> = {
  payg: [
    'Full analytics dashboard',
    'Student & subject analytics',
    'CSV export',
    'Credits never expire',
  ],
  starter: [
    '10 file uploads',
    'Full analytics dashboard',
    'Promotion eligibility',
    'CSV export',
    'Credits never expire',
  ],
  school: [
    '50 file uploads',
    'Full analytics dashboard',
    'Promotion eligibility',
    'Teacher management',
    'Bulk nomenclature import',
    'Priority email support',
  ],
  institution: [
    '200 file uploads',
    'All School features',
    'Multi-campus support',
    'Unlimited team members',
    'Dedicated onboarding',
    'SLA-backed support',
  ],
};

export default function Billing() {
  const { tenantSlug } = useParams();
  const [checkoutPack, setCheckoutPack] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(0);
  const [txRange, setTxRange] = useState<'all' | '30d' | '90d' | '180d'>('all');
  const TX_PAGE_SIZE = 10;

  const { data: packsData, isLoading: packsLoading } = useQuery({
    queryKey: ['billing-packs', tenantSlug],
    queryFn: () => apiClient.get<PacksResponse>(`/api/t/${tenantSlug}/billing/packs`),
    enabled: !!tenantSlug,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['billing-balance', tenantSlug],
    queryFn: () => apiClient.get<BalanceResponse>(`/api/t/${tenantSlug}/billing/balance`),
    enabled: !!tenantSlug,
  });

  const checkout = useMutation({
    mutationFn: (packId: string) =>
      apiClient.post<{ authorizationUrl: string }>(
        `/api/t/${tenantSlug}/billing/checkout`,
        { packId }
      ),
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl;
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not start payment — try again');
      setCheckoutPack(null);
    },
  });

  return (
    <AppShell>
      <div className="container-page py-10">
        {/* Header + balance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2">
            <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
              — Billing
            </span>
            <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2 mb-3">
              Top up upload credits
            </h1>
            <p className="text-[15px] text-ink-soft leading-relaxed max-w-[500px]">
              Pay only for what you upload. Credits never expire. Buy more, pay less per file.
            </p>
          </div>
          <div className="card p-6 flex flex-col">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">
              <Wallet size={13} />
              Current balance
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[40px] font-bold tracking-tightest leading-none text-accent">
                {balanceData?.balance ?? 0}
              </span>
              <span className="text-[14px] text-muted">uploads</span>
            </div>
            <div className="text-[12.5px] text-muted">
              {balanceData?.lifetimePurchased ?? 0} purchased ·{' '}
              {balanceData?.lifetimeSpent ?? 0} used
            </div>
          </div>
        </div>

        {/* Free credit callout — show only to new users who haven't purchased */}
        {balanceData && balanceData.lifetimePurchased === 0 && (
          <div className="flex items-start gap-3 mb-8 px-5 py-4 rounded-lg bg-sage-soft border border-sage/20">
            <Info size={15} className="text-sage mt-0.5 flex-shrink-0" />
            <p className="text-[13.5px] text-ink-soft leading-snug">
              Your workspace includes{' '}
              <strong className="text-ink">1 free upload credit</strong> to try Acumen.{' '}
              {balanceData.balance > 0
                ? "It's waiting for you — upload a results file to use it."
                : "It's been used. Top up below to continue uploading."}
            </p>
          </div>
        )}

        {/* Pricing grid */}
        <div className="card overflow-hidden mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {packsLoading
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="p-7 border-r border-border-soft last:border-r-0">
                    <Skeleton className="h-3 w-16 mb-5" />
                    <Skeleton className="h-12 w-24 mb-2" />
                    <Skeleton className="h-3 w-32 mb-6" />
                    <Skeleton className="h-px w-full mb-5" />
                    <div className="space-y-2.5 mb-7">
                      {[0, 1, 2, 3].map((j) => (
                        <Skeleton key={j} className="h-4 w-full" />
                      ))}
                    </div>
                    <Skeleton className="h-9 w-full rounded" />
                  </div>
                ))
              : packsData?.packs.map((pack, idx) => (
                  <PricingCard
                    key={pack.id}
                    pack={pack}
                    features={FEATURES[pack.id]}
                    isLast={idx === packsData.packs.length - 1}
                    isLoading={checkout.isPending && checkoutPack === pack.id}
                    disabled={checkout.isPending}
                    onBuy={() => {
                      setCheckoutPack(pack.id);
                      checkout.mutate(pack.id);
                    }}
                  />
                ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mb-12 text-[12.5px] text-faint">
          <Lock size={11} className="text-faint" />
          <span>
            Clicking "Get started" will securely redirect you to Paystack to complete payment ·
            Charged in {packsData?.currency ?? 'GHS'} · Credits never expire
          </span>
        </div>

        {/* Recent activity */}
        {balanceData && balanceData.transactions.length > 0 && (() => {
          // Date-range filter
          const now = Date.now();
          const cutoffMs: Record<typeof txRange, number> = {
            all: 0,
            '30d': now - 30 * 86400_000,
            '90d': now - 90 * 86400_000,
            '180d': now - 180 * 86400_000,
          };
          const filteredTxns = balanceData.transactions.filter(
            (t) => new Date(t.createdAt).getTime() >= cutoffMs[txRange]
          );
          const totalPages = Math.ceil(filteredTxns.length / TX_PAGE_SIZE);
          const safePage = Math.min(txPage, Math.max(0, totalPages - 1));
          const pageTxns = filteredTxns.slice(
            safePage * TX_PAGE_SIZE,
            (safePage + 1) * TX_PAGE_SIZE
          );
          return (
            <div>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h2 className="text-[20px] font-bold tracking-tighter flex items-center gap-2">
                  <Receipt size={18} className="text-muted" />
                  Recent activity
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-muted">
                    {filteredTxns.length} transaction{filteredTxns.length !== 1 ? 's' : ''}
                    {txRange !== 'all' && ` · filtered`}
                  </span>
                  <select
                    value={txRange}
                    onChange={(e) => { setTxRange(e.target.value as typeof txRange); setTxPage(0); }}
                    className="text-[12.5px] font-semibold border border-border rounded px-3 py-1.5 bg-surface cursor-pointer text-ink hover:border-ink transition-colors"
                  >
                    <option value="all">All time</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 3 months</option>
                    <option value="180d">Last 6 months</option>
                  </select>
                </div>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-[14px]">
                  <thead className="bg-surface-alt border-b border-border">
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Note</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTxns.map((t) => (
                      <tr key={t.id} className="border-b border-border-soft last:border-0">
                        <td className="px-5 py-3">
                          <TxnTypeBadge type={t.type} />
                        </td>
                        <td className="px-5 py-3 text-ink-soft">{t.note ?? '—'}</td>
                        <td
                          className="px-5 py-3 text-right font-semibold"
                          style={{ color: t.amount > 0 ? '#166534' : '#9A3412' }}
                        >
                          {t.amount > 0 ? '+' : ''}
                          {t.amount}
                        </td>
                        <td className="px-5 py-3 text-right">{t.balanceAfter}</td>
                        <td className="px-5 py-3 text-right text-muted text-[12.5px]">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination footer */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border-soft bg-surface-alt text-[12.5px]">
                    <span className="text-muted">
                      Page {safePage + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTxPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="px-3 py-1.5 rounded border border-border text-ink font-semibold disabled:opacity-40 hover:bg-border-soft transition-colors"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setTxPage((p) => p + 1)}
                        disabled={safePage >= totalPages - 1}
                        className="px-3 py-1.5 rounded border border-border text-ink font-semibold disabled:opacity-40 hover:bg-border-soft transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
                {filteredTxns.length === 0 && txRange !== 'all' && (
                  <div className="px-5 py-8 text-center text-[13.5px] text-muted">
                    No transactions in this period
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}

function PricingCard({
  pack,
  features,
  isLast,
  isLoading,
  disabled,
  onBuy,
}: {
  pack: Pack;
  features: string[];
  isLast: boolean;
  isLoading: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const featured = pack.popular === true;
  return (
    <div
      className={`p-7 border-r border-border-soft last:border-r-0 flex flex-col relative
        ${featured ? 'text-bg' : 'text-ink'}`}
      style={
        featured
          ? {
              background:
                'linear-gradient(165deg, #1c1410 0%, #0A0A0B 60%, #2a1a08 100%)',
            }
          : undefined
      }
    >
      {featured && (
        <span
          className="absolute top-4 right-4 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded text-ink"
          style={{ background: '#FB923C' }}
        >
          POPULAR
        </span>
      )}
      <div
        className={`text-[12px] font-semibold uppercase tracking-wider mb-5 ${
          featured ? 'text-bg/70' : 'text-muted'
        }`}
      >
        {pack.name}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className={`text-[20px] font-bold ${featured ? 'text-bg' : 'text-ink'}`}>$</span>
        <span
          className={`text-[44px] font-bold tracking-tightest leading-none ${
            featured ? 'text-bg' : 'text-ink'
          }`}
        >
          {pack.priceUsd}
        </span>
        {pack.id === 'payg' && (
          <span className={`text-[13px] ${featured ? 'text-bg/70' : 'text-muted'}`}>
            /upload
          </span>
        )}
      </div>
      <p
        className={`text-[12.5px] mb-5 ${featured ? 'text-bg/70' : 'text-muted'}`}
      >
        {pack.id === 'payg'
          ? 'Single upload'
          : `${pack.uploads} uploads · $${pack.perUploadUsd.toFixed(2)} each`}
      </p>
      <hr
        className={`border-0 border-t mb-5 ${
          featured ? 'border-bg/15' : 'border-border-soft'
        }`}
      />
      <ul className="flex-1 space-y-2.5 mb-7">
        {features.map((f) => (
          <li
            key={f}
            className={`flex items-start gap-2 text-[13.5px] leading-relaxed ${
              featured ? 'text-bg/85' : 'text-ink-soft'
            }`}
          >
            <Check
              size={14}
              className="mt-0.5 flex-shrink-0"
              style={{ color: featured ? '#FB923C' : '#9A3412' }}
              strokeWidth={2.5}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        onClick={onBuy}
        disabled={disabled}
        size="md"
        className="w-full"
        variant={featured ? 'accent' : 'secondary'}
      >
        {isLoading ? 'Redirecting…' : pack.id === 'payg' ? 'Buy 1 upload' : 'Get started'}
      </Button>
      <p
        className={`text-[11.5px] mt-3 text-center ${
          featured ? 'text-bg/50' : 'text-faint'
        }`}
      >
        ≈ {pack.currency} {pack.amountLocal.toFixed(2)}
      </p>
    </div>
  );
}

function TxnTypeBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    purchase: { bg: '#BBF7D0', fg: '#166534', label: 'Purchase' },
    upload: { bg: '#FED7AA', fg: '#9A3412', label: 'Upload' },
    refund: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Refund' },
    admin_grant: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Admin grant' },
    admin_revoke: { bg: '#FBCFE8', fg: '#BE185D', label: 'Admin revoke' },
  };
  const s = styles[type] ?? { bg: '#F0EFEB', fg: '#71717A', label: type };
  return (
    <span
      className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
