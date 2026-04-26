import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useSession, signOut } from '@/lib/auth-client';
import { apiClient, ApiError } from '@/lib/api';
import { COUNTRIES, slugSchema } from '@acumen/shared';

const COUNTRY_TO_DIAL: Record<string, string> = COUNTRIES.reduce(
  (acc, c) => ({ ...acc, [c.iso]: c.dial }),
  {} as Record<string, string>
);

const JOB_TITLES = [
  'Headteacher / Principal',
  'Deputy Headteacher',
  'Academic Director',
  'Head of Department',
  'Exam Officer',
  'IT / Data Manager',
  'Teacher',
  'Other',
];

interface MeData {
  user: { id: string; email: string; name: string | null; phone: string | null };
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
  const { data: session, isPending: sessionPending } = useSession();

  // ── Profile fields ────────────────────────────────────────
  const [userName, setUserName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+233');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobTitleOther, setJobTitleOther] = useState('');

  // ── Workspace fields ──────────────────────────────────────
  const [workspaceName, setWorkspaceName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [countryCode, setCountryCode] = useState('');

  const [emailDomain, setEmailDomain] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [joinRequests, setJoinRequests] = useState<Record<string, 'loading' | 'sent' | 'error'>>({});
  const [step, setStep] = useState<Step>('loading');

  // Fetch current user + workspaces once session is available
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

  // Pre-fill name from existing session (e.g. Google sign-in)
  useEffect(() => {
    if (me?.user.name && !userName) setUserName(me.user.name);
  }, [me]);

  // Autodetect phone dial code from browser locale (e.g. 'en-GB' → 'GB' → '+44')
  useEffect(() => {
    const lang = (navigator.languages?.[0] ?? navigator.language) || '';
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && COUNTRY_TO_DIAL[region]) {
      setPhoneCode(COUNTRY_TO_DIAL[region]);
    }
  }, []);

  // Sync country code → phone dial code
  useEffect(() => {
    if (countryCode && COUNTRY_TO_DIAL[countryCode]) {
      setPhoneCode(COUNTRY_TO_DIAL[countryCode]);
    }
  }, [countryCode]);

  // Redirect to dashboard if already has a workspace
  useEffect(() => {
    if (me && me.tenants.length > 0) {
      navigate(`/${me.tenants[0].slug}/dashboard`, { replace: true });
    }
  }, [me, navigate]);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!sessionPending && !session) navigate('/signin', { replace: true });
  }, [session, sessionPending, navigate]);

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

  // Determine which step to show
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

    if (!userName.trim()) { setError('Please enter your name.'); return; }

    const slugCheck = slugSchema.safeParse(slug);
    if (!slugCheck.success) {
      setError(slugCheck.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const fullPhone = phone.trim() ? `${phoneCode} ${phone.trim()}` : '';
      const effectiveJobTitle =
        jobTitle === 'Other' && jobTitleOther.trim() ? jobTitleOther.trim() : jobTitle;
      const res = await apiClient.post<{ tenant: { slug: string } }>('/api/tenants/with-org', {
        orgName: workspaceName.trim(),
        workspaceName: workspaceName.trim(),
        workspaceSlug: slug,
        countryCode: countryCode || undefined,
        emailDomain: emailDomain.trim() || undefined,
        userName: userName.trim(),
        userPhone: fullPhone || undefined,
        userJobTitle: effectiveJobTitle || undefined,
      });
      setSlugSuggestions([]);
      navigate(`/${res.tenant.slug}/dashboard`, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      setError(msg);
      // If slug is taken, generate alternative suggestions
      if (msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
        const base = slug.replace(/-\d+$/, ''); // strip trailing -1, -2 etc
        setSlugSuggestions([
          `${base}-school`,
          `${base}-2`,
          `${base}-hs`,
        ].filter((s) => s !== slug));
      } else {
        setSlugSuggestions([]);
      }
    } finally {
      setSubmitting(false);
    }
  }

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
        <div className="w-full max-w-[520px]">

          {/* ── STEP: Domain suggestions ─────────────────────────── */}
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

          {/* ── STEP: Create workspace ────────────────────────────── */}
          {step === 'create' && (
            <div>
              <div className="mb-8">
                <span className="eyebrow-pill mb-5">Welcome to Acumen</span>
                <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-3">
                  Set up your school
                </h1>
                <p className="text-[15px] text-ink-soft leading-relaxed">
                  Tell us a little about yourself and your school. This takes under a minute.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">

                {/* ── Profile section ─────────────────────────── */}
                <div className="card p-7 space-y-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-1">
                    About you
                  </div>

                  <div>
                    <Label htmlFor="userName">Your name</Label>
                    <Input
                      id="userName"
                      placeholder="Dr. Kwame Mensah"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                      autoFocus={!userName}
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="jobTitle">Your role at school</Label>
                    <select
                      id="jobTitle"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded text-[14.5px] bg-surface border border-border text-ink outline-none focus:border-ink focus:shadow-focus appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 14px center',
                        paddingRight: 38,
                      }}
                    >
                      <option value="">Select your role</option>
                      {JOB_TITLES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {jobTitle === 'Other' && (
                      <Input
                        className="mt-2"
                        placeholder="Describe your role…"
                        value={jobTitleOther}
                        onChange={(e) => setJobTitleOther(e.target.value)}
                        autoFocus
                        maxLength={80}
                      />
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone number <span className="text-faint font-normal">(optional)</span></Label>
                    <div className="flex rounded border border-border bg-surface focus-within:border-ink focus-within:shadow-focus transition-colors overflow-hidden">
                      <select
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        aria-label="Country code"
                        className="border-r border-border bg-surface-alt pl-3 pr-7 py-3 text-[14px] font-semibold text-ink outline-none cursor-pointer appearance-none flex-shrink-0"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 8px center',
                        }}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.iso} value={c.dial}>
                            {c.flag} {c.dial}
                          </option>
                        ))}
                      </select>
                      <input
                        id="phone"
                        type="tel"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="20 123 4567"
                        className="flex-1 px-3 py-3 text-[14.5px] text-ink bg-surface outline-none placeholder:text-faint min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {/* ── School section ───────────────────────────── */}
                <div className="card p-7 space-y-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-1">
                    Your school
                  </div>

                  <div>
                    <Label htmlFor="workspaceName">School name</Label>
                    <Input
                      id="workspaceName"
                      placeholder="Heritage International School"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      required
                      autoComplete="organization"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="countryCode">Country</Label>
                      <select
                        id="countryCode"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full px-4 py-3 rounded text-[14.5px] bg-surface border border-border text-ink outline-none focus:border-ink focus:shadow-focus appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                          paddingRight: 38,
                        }}
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.iso} value={c.iso}>{c.flag} {c.name}</option>
                        ))}
                      </select>
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
                      <p className="text-[12px] text-muted mt-1.5">Cannot be changed later.</p>
                    </div>
                  </div>

                  {/* Optional: claim email domain — always visible */}
                  <div>
                    <Label htmlFor="emailDomain">
                      School email domain{' '}
                      <span className="text-faint font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="emailDomain"
                      placeholder="schoolname.edu"
                      value={emailDomain}
                      onChange={(e) => setEmailDomain(e.target.value.toLowerCase().trim())}
                      type="text"
                    />
                    <p className="text-[12px] text-muted mt-1.5">
                      Staff with this email domain will be suggested to join your workspace when they sign up.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="text-[13px] text-coral bg-coral-soft rounded px-3 py-2">
                    {error}
                    {slugSuggestions.length > 0 && (
                      <div className="mt-2">
                        <span className="text-ink font-medium">Try one of these:</span>{' '}
                        {slugSuggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => { setSlug(s); setSlugTouched(true); setSlugSuggestions([]); setError(null); }}
                            className="inline-block font-mono text-[12px] bg-coral/10 hover:bg-coral/20 px-1.5 py-0.5 rounded mr-1 transition-colors text-coral"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={submitting || !userName.trim() || !workspaceName || !slug}
                >
                  {submitting ? 'Setting up…' : 'Create school workspace →'}
                </Button>

                <p className="text-[12.5px] text-muted text-center -mt-3">
                  Your first upload is free. No credit card needed.
                </p>
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
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
