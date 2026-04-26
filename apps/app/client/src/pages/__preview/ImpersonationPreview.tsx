import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import Upload from '../Upload';

const mockMe = {
  user: { id: 'u3', email: 'olu.adekunle@heritage.edu', name: 'Olu Adekunle', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: 'preview', name: 'Heritage International School', role: 'member' }],
  impersonation: { realEmail: 'team@acumen.app', realName: 'Acumen Team' },
};
const mockTenantOverview = {
  tenant: { id: 't1', slug: 'preview', name: 'Heritage International School' },
  membership: { role: 'member' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};
const mockUploads = {
  uploads: [
    { id: '1', fileName: 'IGCSE_June_2024_Comprehensive.xlsx', examType: 'IGCSE' as const, month: 'June', year: 2024, recordCount: 1024, status: 'processed' as const, fileFormat: 'comprehensive', createdAt: new Date().toISOString() },
  ],
};

export default function ImpersonationPreview() {
  const qc = useQueryClient();
  const { tenantSlug } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['me'], mockMe);
    qc.setQueryData(['tenant', tenantSlug], mockTenantOverview);
    qc.setQueryData(['uploads', tenantSlug], mockUploads);
    setReady(true);
  }, [qc, tenantSlug]);
  if (!ready) return null;
  return <Upload />;
}
