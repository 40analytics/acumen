import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AdminTenant from '../AdminTenant';

const mock = {
  tenant: {
    id: 't1',
    slug: 'heritage',
    name: 'Heritage International School',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  balance: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
  members: [
    { userId: 'u1', role: 'owner' as const, joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(), email: 'kwame@heritage.edu', name: 'Dr. Kwame Mensah' },
    { userId: 'u2', role: 'admin' as const, joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(), email: 'adwoa@heritage.edu', name: 'Adwoa Boateng' },
    { userId: 'u3', role: 'member' as const, joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), email: 'olu.adekunle@heritage.edu', name: 'Olu Adekunle' },
    { userId: 'u4', role: 'member' as const, joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), email: 'sarah.whitmore@heritage.edu', name: 'Sarah Whitmore' },
  ],
  recentUploads: [
    { id: 'up1', fileName: 'IGCSE_June_2024_Comprehensive.xlsx', examType: 'IGCSE', month: 'June', year: 2024, recordCount: 1024, status: 'processed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: 'up2', fileName: 'ALevel_June_2024_Provisional.xlsx', examType: 'A Level', month: 'June', year: 2024, recordCount: 384, status: 'processed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
    { id: 'up3', fileName: 'IGCSE_November_2023.xlsx', examType: 'IGCSE', month: 'November', year: 2023, recordCount: 312, status: 'processed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  ],
  recentTxns: [
    { id: 'tx1', type: 'upload', amount: -1, balanceAfter: 47, note: 'Upload: IGCSE_June_2024.xlsx', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: 'tx2', type: 'admin_grant', amount: 5, balanceAfter: 48, note: 'Trial extension — partner school', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    { id: 'tx3', type: 'purchase', amount: 50, balanceAfter: 43, note: 'Credit purchase: school', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
    { id: 'tx4', type: 'upload', amount: -1, balanceAfter: 9, note: 'Upload: ALevel_June_2024.xlsx', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() },
  ],
  recentPurchases: [
    { id: 'p1', packId: 'school', creditsToCredit: 50, amountKobo: 118800, currency: 'GHS', status: 'success', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
    { id: 'p2', packId: 'starter', creditsToCredit: 10, amountKobo: 42000, currency: 'GHS', status: 'success', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() },
  ],
};

const mockMe = {
  user: { id: 'admin1', email: 'team@acumen.app', name: 'Acumen Team', isSuperAdmin: true },
  tenants: [],
  impersonation: null,
};

export default function AdminTenantPreview() {
  const qc = useQueryClient();
  const { tenantId } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['me'], mockMe);
    qc.setQueryData(['admin-tenant', tenantId], mock);
    setReady(true);
  }, [qc, tenantId]);
  if (!ready) return null;
  return <AdminTenant />;
}
