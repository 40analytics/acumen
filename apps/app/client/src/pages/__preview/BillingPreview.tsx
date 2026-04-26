/**
 * DEV PREVIEW — pre-populates the React Query cache with mock data,
 * then renders the real Billing page so we can verify design.
 * Mounted at /preview/billing (outside ProtectedRoute) in dev only.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Billing from '../Billing';

const SLUG = 'preview';

const mockPacks = {
  packs: [
    { id: 'payg', name: 'Pay-as-you-go', uploads: 1, priceUsd: 5, perUploadUsd: 5.0, amountLocal: 60, amountKobo: 6000, currency: 'GHS' },
    { id: 'starter', name: 'Starter', uploads: 10, priceUsd: 35, perUploadUsd: 3.5, amountLocal: 420, amountKobo: 42000, currency: 'GHS' },
    { id: 'school', name: 'School', uploads: 50, priceUsd: 99, perUploadUsd: 1.98, popular: true, amountLocal: 1188, amountKobo: 118800, currency: 'GHS' },
    { id: 'institution', name: 'Institution', uploads: 200, priceUsd: 249, perUploadUsd: 1.25, amountLocal: 2988, amountKobo: 298800, currency: 'GHS' },
  ],
  currency: 'GHS',
  usdRate: 12,
};

const mockBalance = {
  balance: 47,
  lifetimePurchased: 60,
  lifetimeSpent: 13,
  transactions: [
    { id: '1', type: 'upload', amount: -1, balanceAfter: 47, note: 'Upload: IGCSE_June_2024.xlsx', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: '2', type: 'purchase', amount: 50, balanceAfter: 48, note: 'Credit purchase: school', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
    { id: '3', type: 'upload', amount: -1, balanceAfter: 9, note: 'Upload: ALevel_June_2024.xlsx', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
  ],
};

const mockTenantOverview = {
  tenant: { id: 't1', slug: SLUG, name: 'Heritage International School' },
  membership: { role: 'owner' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};

const mockMe = {
  user: { id: 'u1', email: 'preview@acumen.app', name: 'Preview User', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: SLUG, name: 'Heritage International School', role: 'owner' }],
};

export default function BillingPreview() {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryClient.setQueryData(['billing-packs', SLUG], mockPacks);
    queryClient.setQueryData(['billing-balance', SLUG], mockBalance);
    queryClient.setQueryData(['tenant', SLUG], mockTenantOverview);
    queryClient.setQueryData(['me'], mockMe);
    setReady(true);
  }, [queryClient]);

  if (!ready) return null;
  return <Billing />;
}
