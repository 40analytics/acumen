import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import Promotion from '../Promotion';

const mockMe = {
  user: { id: 'u1', email: 'kwame@heritage.edu', name: 'Dr. Kwame Mensah', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: 'preview', name: 'Heritage International School', role: 'owner' }],
  impersonation: null,
};
const mockTenantOverview = {
  tenant: { id: 't1', slug: 'preview', name: 'Heritage International School' },
  membership: { role: 'owner' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};

const mockPromotion = {
  summary: { total: 142, eligible: 118, notEligible: 24, eligibleRate: 83.1 },
  candidates: [
    { candidateNumber: '0001', candidateName: 'Abena Boateng', totalSubjects: 9, totalPassed: 9, hasEnglish: true, hasMath: true, hasScience: true, eligible: true, reasons: [] },
    { candidateNumber: '0002', candidateName: 'Kofi Asante', totalSubjects: 9, totalPassed: 8, hasEnglish: true, hasMath: true, hasScience: true, eligible: true, reasons: [] },
    { candidateNumber: '0003', candidateName: 'Adwoa Mensah', totalSubjects: 8, totalPassed: 7, hasEnglish: true, hasMath: true, hasScience: true, eligible: true, reasons: [] },
    { candidateNumber: '0004', candidateName: 'Yaw Owusu', totalSubjects: 9, totalPassed: 6, hasEnglish: true, hasMath: true, hasScience: true, eligible: true, reasons: [] },
    { candidateNumber: '0027', candidateName: 'Akua Donkor', totalSubjects: 9, totalPassed: 5, hasEnglish: true, hasMath: true, hasScience: true, eligible: true, reasons: [] },
    { candidateNumber: '0042', candidateName: 'Ama Osei', totalSubjects: 8, totalPassed: 4, hasEnglish: true, hasMath: false, hasScience: true, eligible: false, reasons: ['Only 4 subjects passed at C or above (need 5)', 'Missing C+ in Mathematics'] },
    { candidateNumber: '0058', candidateName: 'Kojo Adjei', totalSubjects: 7, totalPassed: 3, hasEnglish: false, hasMath: true, hasScience: false, eligible: false, reasons: ['Only 3 subjects passed at C or above (need 5)', 'Missing C+ in English', 'Missing C+ in any Science'] },
    { candidateNumber: '0089', candidateName: 'Esi Frimpong', totalSubjects: 6, totalPassed: 4, hasEnglish: true, hasMath: true, hasScience: false, eligible: false, reasons: ['Only 4 subjects passed at C or above (need 5)', 'Missing C+ in any Science'] },
  ],
};

export default function PromotionPreview() {
  const qc = useQueryClient();
  const { tenantSlug } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['me'], mockMe);
    qc.setQueryData(['tenant', tenantSlug], mockTenantOverview);
    qc.setQueryData(['promotion', tenantSlug, undefined], mockPromotion);
    setReady(true);
  }, [qc, tenantSlug]);
  if (!ready) return null;
  return <Promotion />;
}
