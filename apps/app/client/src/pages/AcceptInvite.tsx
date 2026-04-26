import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiError } from '@/lib/api';
import { authClient, useSession } from '@/lib/auth-client';
import { Check, X, Mail, AlertCircle } from 'lucide-react';

interface InviteData {
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invite?: { email: string; role: 'owner' | 'admin' | 'member'; expiresAt: string };
  tenant?: { slug: string; name: string };
  inviter?: { name: string | null; email: string };
  currentUser?: { email: string; name: string | null } | null;
}

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [emailForSignIn, setEmailForSignIn] = useState('');
  const [signInState, setSignInState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => apiClient.get<InviteData>(`/api/invites/${token}`),
    enabled: !!token,
  });

  // Pre-fill the sign-in field with the invite email when first loaded
  useEffect(() => {
    if (data?.invite?.email && !emailForSignIn) {
      setEmailForSignIn(data.invite.email);
    }
  }, [data, emailForSignIn]);

  const accept = useMutation({
    mutationFn: () =>
      apiClient.post<{ tenantSlug: string; alreadyMember: boolean }>(
        `/api/invites/${token}/accept`
      ),
    onSuccess: (res) => {
      navigate(`/${res.tenantSlug}/dashboard`);
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container-page py-6">
        <Logo size="md" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[440px]">
          <div className="card p-8">
            {isLoading && <div className="text-center text-muted py-8">Loading…</div>}

            {data?.status === 'expired' && (
              <Status
                icon={<AlertCircle size={26} />}
                tint="coral"
                title="Invitation expired"
                body="This invitation has expired. Ask the inviter to send a new one."
              />
            )}
            {data?.status === 'revoked' && (
              <Status
                icon={<X size={26} />}
                tint="coral"
                title="Invitation revoked"
                body="This invitation was cancelled by the workspace owner."
              />
            )}
            {data?.status === 'accepted' && (
              <Status
                icon={<Check size={26} />}
                tint="sage"
                title="Already accepted"
                body="You've already joined this workspace."
                action={
                  data.tenant && (
                    <Button asChild variant="primary" size="lg" className="w-full">
                      <a href={`/${data.tenant.slug}/dashboard`}>Open workspace →</a>
                    </Button>
                  )
                }
              />
            )}

            {data?.status === 'pending' && data.invite && data.tenant && (
              <>
                <div className="text-center mb-6">
                  <span className="eyebrow-pill mb-4">You're invited</span>
                  <h1 className="text-[24px] font-bold tracking-tightest leading-[1.15] mb-2">
                    Join <span className="text-accent">{data.tenant.name}</span>
                  </h1>
                  <p className="text-[14.5px] text-ink-soft leading-relaxed">
                    {data.inviter?.name ?? data.inviter?.email ?? 'A teammate'} has invited{' '}
                    <strong className="text-ink">{data.invite.email}</strong> to join their
                    workspace as <strong>{data.invite.role}</strong>.
                  </p>
                </div>

                {/* CASE 1: not signed in → magic link to invite email */}
                {!session && (
                  <SignInPanel
                    inviteEmail={data.invite.email}
                    state={signInState}
                    onSent={() => setSignInState('sent')}
                    onSending={() => setSignInState('sending')}
                  />
                )}

                {/* CASE 2: signed in with the right email → accept button */}
                {session?.user.email.toLowerCase() === data.invite.email.toLowerCase() && (
                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={() => accept.mutate()}
                      disabled={accept.isPending}
                    >
                      {accept.isPending ? 'Joining…' : `Accept & join ${data.tenant.name} →`}
                    </Button>
                    {accept.isError && (
                      <div className="text-[13px] text-coral bg-coral-soft rounded px-3 py-2">
                        {accept.error instanceof ApiError
                          ? accept.error.message
                          : 'Could not accept'}
                      </div>
                    )}
                  </div>
                )}

                {/* CASE 3: signed in but wrong email */}
                {session &&
                  session.user.email.toLowerCase() !== data.invite.email.toLowerCase() && (
                    <div className="space-y-3">
                      <div className="bg-coral-soft border border-coral/20 rounded p-4 text-[13.5px]">
                        <div className="flex items-start gap-2.5 mb-2">
                          <AlertCircle
                            size={16}
                            className="text-coral mt-0.5 flex-shrink-0"
                          />
                          <div>
                            <strong className="text-coral">Wrong account</strong>
                            <p className="text-ink-soft mt-1">
                              This invitation is for{' '}
                              <strong className="text-ink">{data.invite.email}</strong>, but
                              you're signed in as{' '}
                              <strong className="text-ink">{session.user.email}</strong>.
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={async () => {
                          await authClient.signOut();
                          await refetch();
                        }}
                      >
                        Sign out & switch account
                      </Button>
                    </div>
                  )}
              </>
            )}
          </div>
          <p className="text-center text-[12px] text-muted mt-4">
            Need help? Email{' '}
            <a href="mailto:hello@acumen.app" className="text-ink hover:underline">
              hello@acumen.app
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Status({
  icon,
  tint,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  tint: 'sage' | 'coral';
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const bg = tint === 'sage' ? 'bg-sage-soft text-sage' : 'bg-coral-soft text-coral';
  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-5 ${bg}`}>
        {icon}
      </div>
      <h2 className="text-[22px] font-bold tracking-tightest mb-2">{title}</h2>
      <p className="text-[14.5px] text-ink-soft mb-6">{body}</p>
      {action}
    </div>
  );
}

function SignInPanel({
  inviteEmail,
  state,
  onSending,
  onSent,
}: {
  inviteEmail: string;
  state: 'idle' | 'sending' | 'sent';
  onSending: () => void;
  onSent: () => void;
}) {
  async function handleSignIn() {
    onSending();
    await authClient.signIn.magicLink({
      email: inviteEmail,
      callbackURL: window.location.origin + window.location.pathname,
    });
    onSent();
  }
  async function handleGoogle() {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin + window.location.pathname,
    });
  }

  if (state === 'sent') {
    return (
      <div className="text-center bg-sage-soft/40 rounded-lg p-5">
        <Mail size={24} className="mx-auto text-sage mb-3" />
        <div className="text-[14.5px] font-semibold text-ink mb-1">Check your inbox</div>
        <div className="text-[13px] text-ink-soft">
          We sent a sign-in link to <strong>{inviteEmail}</strong>. Open it on this device to
          continue.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted text-center mb-1">
        Sign in to accept this invitation:
      </p>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={handleGoogle}
      >
        <GoogleG />
        Continue with Google
      </Button>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={state === 'sending'}
        onClick={handleSignIn}
      >
        {state === 'sending' ? 'Sending…' : `Email me a link at ${inviteEmail}`}
      </Button>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
