/**
 * DEV PREVIEW — upload page with mock recent uploads.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import Upload from '../Upload';

const mockMe = {
  user: { id: 'u1', email: 'preview@acumen.app', name: 'Preview User', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: 'preview', name: 'Heritage International School', role: 'owner' }],
};

const mockTenantOverview = {
  tenant: { id: 't1', slug: 'preview', name: 'Heritage International School' },
  membership: { role: 'owner' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};

const mockUploads = {
  uploads: [
    {
      id: '1',
      fileName: 'IGCSE_June_2024_Comprehensive.xlsx',
      examType: 'IGCSE' as const,
      month: 'June',
      year: 2024,
      recordCount: 1024,
      status: 'processed' as const,
      fileFormat: 'comprehensive',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: '2',
      fileName: 'ALevel_June_2024_Provisional.xlsx',
      examType: 'A Level' as const,
      month: 'June',
      year: 2024,
      recordCount: 384,
      status: 'processed' as const,
      fileFormat: 'summary',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: '3',
      fileName: 'IGCSE_November_2023.xlsx',
      examType: 'IGCSE' as const,
      month: 'November',
      year: 2023,
      recordCount: 312,
      status: 'processed' as const,
      fileFormat: 'comprehensive',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    },
  ],
};

export default function UploadPreview() {
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
