import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { authClient } from '@/lib/auth-client';
import { COUNTRIES } from '@acumen/shared';

const MARKETING_URL =
  (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? '/';

const COUNTRY_TO_DIAL: Record<string, string> = COUNTRIES.reduce(
  (acc, c) => ({ ...acc, [c.iso]: c.dial }),
  {} as Record<string, string>
);

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function SignUp() {
  const [params] = useSearchParams();

  const [name, setName] = useState(params.get('name')?.trim() ?? '');
  const [school, setSchool] = useState(params.get('school')?.trim() ?? '');
  const [email, setEmail] = useState(params.get('email')?.trim().toLowerCase() ?? '');
  const [country, setCountry] = useState(params.get('country')?.trim() ?? '');
  // Phone: prefer "+233 24 …" if marketing passed it, else split country code from input
  const initialPhone = params.get('phone')?.trim() ?? '';
  const phoneSplitMatch = initialPhone.match(/^(\+\d{1,4})\s*(.*)$/);
  const [phoneCode, setPhoneCode] = useState(phoneSplitMatch?.[1] ?? '+233');
  const [phone, setPhone] = useState(phoneSplitMatch?.[2] ?? '');

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Whenever the user picks a country, snap the phone code to match
  useEffect(() => {
    if (country && COUNTRY_TO_DIAL[country]) setPhoneCode(COUNTRY_TO_DIAL[country]);
  }, [country]);

  function buildCallbackURL() {
    const cb = new URLSearchParams();
    if (school.trim()) cb.set('school', school.trim());
    if (name.trim()) cb.set('name', name.trim());
    if (country) cb.set('country', country);
    const fullPhone = phone.trim() ? `${phoneCode} ${phone.trim()}` : '';
    if (fullPhone) cb.set('phone', fullPhone);
    // Absolute URL — Better Auth resolves relative paths against its own
    // baseURL (the API host), so we have to point at the app explicitly.
    return (
      window.location.origin +
      '/onboarding' +
      (cb.toString() ? `?${cb.toString()}` : '')
    );
  }

  function validateRequired(): boolean {
    if (!name.trim() || !school.trim() || !email.trim()) {
      setErrorMsg('Please fill name, school and email.');
      return false;
    }
    return true;
  }

  async function handleEmailSignUp(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!validateRequired()) return;
    setStatus('sending');
    try {
      await authClient.signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: buildCallbackURL(),
      });
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Could not send sign-up link. Try again.');
    }
  }

  async function handleGoogleSignUp() {
    setErrorMsg(null);
    if (!name.trim() || !school.trim()) {
      setErrorMsg('Please fill your name and school first.');
      return;
    }
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: buildCallbackURL(),
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Decorative warm glow — matches marketing hero */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div
          className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(202,138,4,0.10) 0%, rgba(202,138,4,0) 70%)',
          }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(22,101,52,0.08) 0%, rgba(22,101,52,0) 70%)',
          }}
        />
      </div>

      <header className="container-page py-6 flex items-center justify-between">
        <a href={MARKETING_URL} className="inline-block">
          <Logo size="md" />
        </a>
        <a
          href={MARKETING_URL}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={13} />
          Back to home
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[480px]">
          <div className="bg-surface border border-border rounded-xl p-8 sm:p-10 shadow-sm">
            {status === 'sent' ? (
              <SentState email={email} onBack={() => setStatus('idle')} />
            ) : (
              <>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-accent bg-accent-soft px-3 py-1 rounded-full mb-5">
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  Get started — first upload free
                </div>

                <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tightest leading-[1.1] mb-2">
                  Create your account
                </h1>
                <p className="text-[14.5px] text-ink-soft leading-relaxed mb-7">
                  Spin up an Acumen workspace for your school in under 60 seconds. Your first
                  upload is on us — no card needed.
                </p>

                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Your name</Label>
                      <Input
                        id="name"
                        type="text"
                        autoComplete="name"
                        autoFocus={!name}
                        placeholder="Dr. Kwame Mensah"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={status === 'sending'}
                      />
                    </div>
                    <div>
                      <Label htmlFor="school">School</Label>
                      <Input
                        id="school"
                        type="text"
                        autoComplete="organization"
                        placeholder="Your school's name"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        required
                        disabled={status === 'sending'}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={status === 'sending'}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <select
                        id="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        disabled={status === 'sending'}
                        className="w-full px-4 py-3 rounded text-[14.5px] bg-surface border border-border text-ink outline-none focus:border-ink focus:shadow-focus disabled:opacity-60 appearance-none cursor-pointer"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                          paddingRight: 38,
                        }}
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.iso} value={c.iso}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone number</Label>
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
                          disabled={status === 'sending'}
                          className="flex-1 px-3 py-3 text-[14.5px] text-ink bg-surface outline-none placeholder:text-faint min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="text-[13px] text-coral bg-coral-soft border border-coral-soft rounded px-3 py-2">
                      {errorMsg}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending link…' : 'Create account →'}
                  </Button>
                  <p className="text-[12px] text-faint text-center">
                    First upload free &nbsp;·&nbsp; No credit card required
                  </p>
                </form>

                <div className="flex items-center gap-3 my-5">
                  <span className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-faint uppercase tracking-wider">
                    or
                  </span>
                  <span className="flex-1 h-px bg-border" />
                </div>

                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={handleGoogleSignUp}
                  type="button"
                  disabled={status === 'sending'}
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>

                <p className="text-[12px] text-faint text-center mt-6">
                  By creating an account you agree to our{' '}
                  <Link to="/terms" className="text-ink-soft hover:text-ink underline-offset-2">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-ink-soft hover:text-ink underline-offset-2">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}
          </div>

          <p className="text-center text-[13.5px] text-muted mt-6">
            Already have an account?{' '}
            <Link
              to="/signin"
              className="text-ink font-semibold hover:text-accent transition-colors"
            >
              Sign in →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function SentState({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sage-soft text-sage mb-5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-[22px] font-bold tracking-tightest mb-2">Check your inbox</h2>
      <p className="text-[14.5px] text-ink-soft leading-relaxed mb-1">
        We sent a sign-up link to
      </p>
      <p className="text-[14.5px] font-semibold text-ink mb-6 break-all">{email}</p>
      <p className="text-[13px] text-muted leading-relaxed mb-6">
        Open the link on this device to continue. The link expires in 15 minutes.
      </p>
      <Button variant="ghost" size="sm" onClick={onBack} type="button">
        ← Use a different email
      </Button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
