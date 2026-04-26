import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import SettingsTeam from '../SettingsTeam';

const mockMe = {
  user: { id: 'u1', email: 'kwame@morningglory.edu', name: 'Dr. Kwame Mensah', isSuperAdmin: false },
  tenants: [{ tenantId: 't1', slug: 'preview', name: 'Heritage International School', role: 'owner' }],
};
const mockTenantOverview = {
  tenant: { id: 't1', slug: 'preview', name: 'Heritage International School' },
  membership: { role: 'owner' },
  credits: { balance: 47, lifetimePurchased: 60, lifetimeSpent: 13 },
};
const mockMembers = {
  members: [
    {
      userId: 'u1',
      role: 'owner' as const,
      joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
      email: 'kwame@morningglory.edu',
      name: 'Dr. Kwame Mensah',
      image: null,
    },
    {
      userId: 'u2',
      role: 'admin' as const,
      joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
      email: 'adwoa@morningglory.edu',
      name: 'Adwoa Boateng',
      image: null,
    },
    {
      userId: 'u3',
      role: 'member' as const,
      joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
      email: 'olu.adekunle@morningglory.edu',
      name: 'Olu Adekunle',
      image: null,
    },
    {
      userId: 'u4',
      role: 'member' as const,
      joinedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      email: 'sarah.whitmore@morningglory.edu',
      name: 'Sarah Whitmore',
      image: null,
    },
  ],
};
const mockInvites = {
  invites: [
    {
      id: 'i1',
      email: 'james.osei@morningglory.edu',
      role: 'member' as const,
      status: 'pending',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: 'i2',
      email: 'priya.sharma@morningglory.edu',
      role: 'admin' as const,
      status: 'pending',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
};

export default function SettingsTeamPreview() {
  const qc = useQueryClient();
  const { tenantSlug } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['me'], mockMe);
    qc.setQueryData(['tenant', tenantSlug], mockTenantOverview);
    qc.setQueryData(['members', tenantSlug], mockMembers);
    qc.setQueryData(['invites', tenantSlug], mockInvites);
    setReady(true);
  }, [qc, tenantSlug]);
  if (!ready) return null;
  return <SettingsTeam />;
}
