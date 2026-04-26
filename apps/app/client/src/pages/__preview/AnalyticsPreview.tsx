/**
 * DEV PREVIEW — analytics dashboard with mock data.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import Analytics from '../Analytics';

const mockMe = {
  user: { id: 'u1', email: 'preview@acumen.app', name: 'Preview User', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: 'preview', name: 'Heritage International School', role: 'owner' }],
};

const mockTenantOverview = {
  tenant: { id: 't1', slug: 'preview', name: 'Heritage International School' },
  membership: { role: 'owner' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};

const mockAnalytics = {
  examType: 'IGCSE',
  overview: {
    totalRecords: 1024,
    uniqueCandidates: 142,
    passRateAA: 68.4,
    passRateC: 91.2,
    avgSubjects: 7.2,
  },
  gradeDistribution: [
    { grade: 'A*', count: 142 },
    { grade: 'A', count: 218 },
    { grade: 'B', count: 264 },
    { grade: 'C', count: 197 },
    { grade: 'D', count: 124 },
    { grade: 'E', count: 51 },
    { grade: 'F', count: 18 },
    { grade: 'G', count: 8 },
    { grade: 'U', count: 2 },
  ],
  topStudents: {
    byAStar: [
      { candidateNumber: '0001', name: 'Abena Boateng', aStars: 8, weighted: 78, subjects: 9 },
      { candidateNumber: '0002', name: 'Kofi Asante', aStars: 7, weighted: 71, subjects: 9 },
      { candidateNumber: '0003', name: 'Adwoa Mensah', aStars: 6, weighted: 65, subjects: 8 },
      { candidateNumber: '0004', name: 'Yaw Owusu', aStars: 5, weighted: 60, subjects: 8 },
      { candidateNumber: '0005', name: 'Akua Donkor', aStars: 5, weighted: 58, subjects: 8 },
    ],
    byWeighted: [],
  },
  subjects: [
    { subject: 'Mathematics (0580)', students: 142, passRateAA: 78, passRateC: 95 },
    { subject: 'Biology (0610)', students: 96, passRateAA: 71, passRateC: 92 },
    { subject: 'Chemistry (0620)', students: 88, passRateAA: 64, passRateC: 88 },
    { subject: 'Physics (0625)', students: 76, passRateAA: 58, passRateC: 84 },
    { subject: 'English Language (0500)', students: 142, passRateAA: 52, passRateC: 91 },
    { subject: 'History (0470)', students: 64, passRateAA: 47, passRateC: 82 },
  ],
  timeline: [
    { period: '2022-06-01', label: 'Jun 2022', students: 132, passRateAA: 56, passRateC: 87 },
    { period: '2022-11-01', label: 'Nov 2022', students: 38, passRateAA: 61, passRateC: 89 },
    { period: '2023-06-01', label: 'Jun 2023', students: 138, passRateAA: 62, passRateC: 90 },
    { period: '2023-11-01', label: 'Nov 2023', students: 42, passRateAA: 65, passRateC: 91 },
    { period: '2024-06-01', label: 'Jun 2024', students: 142, passRateAA: 68, passRateC: 91 },
  ],
};

export default function AnalyticsPreview({ examType }: { examType: 'igcse' | 'alevel' }) {
  const qc = useQueryClient();
  const { tenantSlug } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['me'], mockMe);
    qc.setQueryData(['tenant', tenantSlug], mockTenantOverview);
    qc.setQueryData(['analytics', tenantSlug, examType, undefined], mockAnalytics);
    setReady(true);
  }, [qc, tenantSlug, examType]);
  if (!ready) return null;
  return <Analytics examType={examType} />;
}
