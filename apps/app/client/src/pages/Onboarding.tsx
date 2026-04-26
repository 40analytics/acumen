import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useSession, signOut } from '@/lib/auth-client';
import { apiClient, ApiError } from '@/lib/api';
import { slugSchema } from '@acumen/shared';

interface MeData {
  user: { id: string; email: string; name: string | null };
  tenants: Array<{ slug: string; name: string; role: string }>;
  orgs: Array<{ orgId: string; name: string; slug: string }>;
}

interface OrgSuggestion {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  joinRequestStatus: string | null;
}

type Step = 'loading' | 'suggestions' | 'create';

export default function Onboarding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: session, isPending: sessionPending } = useSession();

  // Pre-fill from sign-up / marketing flow
  const initialSchool = params.get('school')?.trim() ?? '';
  const [orgName, setOrgName] = useState(initialSchool);
  const [workspaceName, setWorkspaceName] = useState(initialSchool);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<Record<string, 'loading' | 'sent' | 'error'>>({});
  const [step, setStep] = useState<Step>('loading');
  const [showEmailDomain, setShowEmailDomain] = useState(false);
  const [emailDomain, setEmailDomain] = useState('');

  // Fetch the user's existing workspaces once the session is known.
  const { data: me, isPending: mePending } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<MeData>('/api/me'),
    enabled: !!session,
  });

  // Fetch domain-based org suggestions
  const { data: suggestionsData, isPending: suggestionsPending } = useQuery({
    queryKey: ['org-suggestions'],
    queryFn: () => apiClient.get<{ orgs: OrgSuggestion[] }>('/api/orgs/suggestions'),
    enabled: !!session && !!me && me.tenants.length === 0,
    retry: false,
  });

  // Redirect to dashboard if user already has a workspace
  useEffect(() => {
    if (me && me.tenants.length > 0) {
      navigate(`/${me.tenants[0].slug}/dashboard`, { replace: true });
    }
  }, [me, navigate]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!sessionPending && !session) navigate('/signin', { replace: true });
  }, [session, sessionPending, navigate]);

  // Determine which step to show once all data is loaded
  useEffect(() => {
    if (!me || suggestionsPending) return;
    if (me.tenants.length > 0) return; // will redirect

    const suggestions = suggestionsData?.orgs ?? [];
    const hasPendingSuggestions = suggestions.some((s) => s.joinRequestStatus !== 'approved');
    if (hasPendingSuggestions && suggestions.length > 0) {
      setStep('suggestions');
    } else {
      setStep('create');
    }
  }, [me, suggestionsData, suggestionsPending]);

  // Auto-generate slug from workspace name
  useEffect(() => {
    if (slugTouched) return;
    setSlug(
      workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40)
    );
  }, [workspaceName, slugTouched]);

  // Sync org name with workspace name (until user touches org name)
  const [orgNameTouched, setOrgNameTouched] = useState(false);
  useEffect(() => {
    if (orgNameTouched) return;
    setOrgName(workspaceName);
  }, [workspaceName, orgNameTouched]);

  async function handleRequestJoin(org: OrgSuggestion) {
    setJoinRequests((prev) => ({ ...prev, [org.id]: 'loading' }));
    try {
      await apiClient.post(`/api/orgs/${org.id}/join-requests`, {});
      setJoinRequests((prev) => ({ ...prev, [org.id]: 'sent' }));
    } catch {
      setJoinRequests((prev) => ({ ...prev, [org.id]: 'error' }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const slugCheck = slugSchema.safeParse(slug);
    if (!slugCheck.success) {
      setError(slugCheck.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ tenant: { slug: string } }>('/api/tenants/with-org', {
        orgName: orgName.trim() || workspaceName.trim(),
        workspaceName: workspaceName.trim(),
        workspaceSlug: slug,
        emailDomain: emailDomain.trim() || undefined,
      });
      navigate(`/${res.tenant.slug}/dashboard`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // Show nothing while we're resolving session / me data.
  const loading = sessionPending || (!!session && mePending) || step === 'loading';
  if (loading) return null;
  if (me && me.tenants.length > 0) return null;

  const suggestions = suggestionsData?.orgs ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container-page py-6 flex items-center justify-between">
        <Logo size="md" />
        <button
          onClick={() => signOut().then(() => navigate('/signin'))}
          className="text-[13px] text-muted hover:text-ink"
        >
          Sign out
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[480px]">

          {/* ── STEP: Domain suggestions ─────────────────── */}
          {step === 'suggestions' && (
            <div>
              <div className="mb-8">
                <span className="eyebrow-pill mb-5">Welcome to Acumen</span>
                <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-3">
                  Join your organisation
                </h1>
                <p className="text-[15px] text-ink-soft leading-relaxed">
                  We found organisations using your email domain. Request to join one, or create your own.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {suggestions.map((org) => {
                  const reqState = joinRequests[org.id];
                  return (
                    <div key={org.id} className="card p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded bg-ink/10 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-ink-soft" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-ink truncate">{org.name}</div>
                          <div className="text-[12px] text-muted flex items-center gap-1.5 mt-0.5">
                            <Users size={11} />
                            {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                          </div>
                        </div>
                      </div>

                      {org.joinRequestStatus === 'approved' ? (
                        <span className="text-[12px] text-emerald-600 font-medium flex-shrink-0">
                          ✓ Member
                        </span>
                      ) : reqState === 'sent' || org.joinRequestStatus === 'pending' ? (
                        <span className="text-[12px] text-muted flex-shrink-0">
                          Request sent
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRequestJoin(org)}
                          disabled={reqState === 'loading'}
                          className="flex-shrink-0"
                        >
                          {reqState === 'loading' ? 'Sending…' : 'Request to join'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-center">
                <button
                  onClick={() => setStep('create')}
                  className="text-[13px] text-ink-soft hover:text-ink underline underline-offset-2"
                >
                  Create my own workspace instead →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Create org + workspace ─────────────── */}
          {step === 'create' && (
            <div>
              <div className="mb-8">
                <span className="eyebrow-pill mb-5">Welcome to Acumen</span>
                <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-3">
                  Set up your workspace
                </h1>
                <p className="text-[15px] text-ink-soft leading-relaxed">
                  Your workspace is where your team collaborates. You can add more workspaces later.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="card p-7 space-y-5">
                <div>
                  <Label htmlFor="workspaceName">School / workspace name</Label>
                  <Input
                    id="workspaceName"
                    placeholder="Heritage International School"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Workspace URL</Label>
                  <div className="flex items-center rounded border border-border bg-surface focus-within:border-ink focus-within:shadow-focus transition-colors">
                    <span className="pl-4 pr-1 text-[14px] text-faint select-none">acumen.app/</span>
                    <input
                      id="slug"
                      className="flex-1 px-1 py-3 text-[14.5px] text-ink bg-transparent outline-none placeholder:text-faint"
                      placeholder="heritage"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        setSlugTouched(true);
                      }}
                      required
                    />
                  </div>
                  <p className="text-[12px] text-muted mt-1.5">
                    Lowercase letters, numbers, and hyphens. Cannot be changed later.
                  </p>
                </div>

                {/* Optional: claim email domain */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowEmailDomain((v) => !v)}
                    className="text-[12.5px] text-accent hover:underline"
                  >
                    {showEmailDomain ? '− Hide' : '+ Claim'} your organisation's email domain
                  </button>
                  {showEmailDomain && (
                    <div className="mt-3">
                      <Label htmlFor="emailDomain">Email domain (optional)</Label>
                      <Input
                        id="emailDomain"
                        placeholder="schoolname.edu"
                        value={emailDomain}
                        onChange={(e) => setEmailDomain(e.target.value.toLowerCase().trim())}
                        type="text"
                      />
                      <p className="text-[12px] text-muted mt-1.5">
                        New users with this domain will be suggested to join your org.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="text-[13px] text-coral bg-coral-soft rounded px-3 py-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={submitting || !workspaceName || !slug}
                >
                  {submitting ? 'Creating…' : 'Create workspace →'}
                </Button>
              </form>

              {suggestions.length > 0 && (
                <div className="text-center mt-4">
                  <button
                    onClick={() => setStep('suggestions')}
                    className="text-[13px] text-ink-soft hover:text-ink underline underline-offset-2"
                  >
                    ← Back to join suggestions
                  </button>
                </div>
              )}

              <p className="text-[12.5px] text-muted text-center mt-5">
                Your first upload is free. No credit card needed.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
