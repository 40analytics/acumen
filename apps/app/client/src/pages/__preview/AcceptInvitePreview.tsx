/**
 * DEV PREVIEW — accept-invite page in the "pending, not signed in" state.
 * Mounted at /__preview/accept-invite/:token
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AcceptInvite from '../AcceptInvite';

const mockInvite = {
  status: 'pending' as const,
  invite: {
    email: 'olu.adekunle@morningglory.edu',
    role: 'admin' as const,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  tenant: { slug: 'preview', name: 'Heritage International School' },
  inviter: { name: 'Dr. Kwame Mensah', email: 'kwame@morningglory.edu' },
  currentUser: null,
};

export default function AcceptInvitePreview() {
  const qc = useQueryClient();
  const { token } = useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    qc.setQueryData(['invite', token], mockInvite);
    setReady(true);
  }, [qc, token]);
  if (!ready) return null;
  return <AcceptInvite />;
}
