import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { authClient } from '@/lib/auth-client';

const MARKETING_URL =
  (import.meta.env.VITE_MARKETING_URL as string | undefined) ?? '/';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function SignIn() {
  const [params] = useSearchParams();
  const errorParam = params.get('error');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(errorParam);

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg(null);
    try {
      await authClient.signIn.magicLink({
        email: email.trim().toLowerCase(),
        callbackURL: window.location.origin + '/onboarding',
      });
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Could not send sign-in link. Try again.');
    }
  }

  async function handleGoogleSignIn() {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin + '/onboarding',
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Decorative warm glow — matches Astro hero */}
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

      {/* Header */}
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

      {/* Body */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          <div className="bg-surface border border-border rounded-xl p-8 sm:p-10 shadow-sm">
            {status === 'sent' ? (
              <SentState email={email} onBack={() => setStatus('idle')} />
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tightest leading-[1.1] mb-2">
                    Sign in to Acumen
                  </h1>
                  <p className="text-[14.5px] text-ink-soft leading-relaxed">
                    Welcome back. Use Google or your email to continue.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full mb-3"
                  onClick={handleGoogleSignIn}
                  type="button"
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>

                <div className="flex items-center gap-3 my-6">
                  <span className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-medium text-faint uppercase tracking-wider">
                    or
                  </span>
                  <span className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={status === 'sending'}
                    />
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
                    disabled={status === 'sending' || !email.trim()}
                  >
                    {status === 'sending' ? 'Sending link…' : 'Send sign-in link'}
                  </Button>
                </form>

                <p className="text-[12.5px] text-faint text-center mt-6">
                  By continuing you agree to our{' '}
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
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-ink font-semibold hover:text-accent transition-colors"
            >
              Get started →
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
        We sent a sign-in link to
      </p>
      <p className="text-[14.5px] font-semibold text-ink mb-6 break-all">{email}</p>
      <p className="text-[13px] text-muted leading-relaxed mb-6">
        The link expires in 15 minutes. If you don't see it, check your spam folder.
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
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
