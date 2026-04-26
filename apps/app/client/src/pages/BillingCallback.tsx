import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiError } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2, Clock } from 'lucide-react';

interface Me {
  user: { id: string; email: string };
}

const VERIFY_TIMEOUT_MS = 15_000;

type State =
  | { kind: 'verifying' }
  | { kind: 'timeout' }
  | { kind: 'success'; uploads: number; pack: string; reference: string; balance?: number }
  | { kind: 'failed'; reason?: string }
  | { kind: 'error'; message: string };

export default function BillingCallback() {
  const { tenantSlug } = useParams();
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ kind: 'verifying' });
  const attemptRef = useRef(0);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<Me>('/api/me'),
  });

  function verify() {
    if (!reference || !tenantSlug) {
      setState({ kind: 'error', message: 'Missing payment reference.' });
      return;
    }
    const attempt = ++attemptRef.current;
    setState({ kind: 'verifying' });

    const timeoutId = setTimeout(() => {
      if (attemptRef.current === attempt) {
        setState({ kind: 'timeout' });
      }
    }, VERIFY_TIMEOUT_MS);

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{
          status: 'success' | 'failed';
          pack: string;
          uploads: number;
          reference: string;
          balanceAfter?: number;
          reason?: string;
        }>(`/api/t/${tenantSlug}/billing/verify?reference=${encodeURIComponent(reference)}`);
        if (cancelled || attemptRef.current !== attempt) return;
        clearTimeout(timeoutId);
        if (res.status === 'success') {
          setState({
            kind: 'success',
            uploads: res.uploads,
            pack: res.pack,
            reference: res.reference,
            balance: res.balanceAfter,
          });
          queryClient.invalidateQueries({ queryKey: ['billing-balance', tenantSlug] });
          queryClient.invalidateQueries({ queryKey: ['tenant', tenantSlug] });
        } else {
          setState({ kind: 'failed', reason: res.reason });
        }
      } catch (err) {
        if (cancelled || attemptRef.current !== attempt) return;
        clearTimeout(timeoutId);
        setState({
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'Could not verify payment.',
        });
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }

  useEffect(() => {
    const cleanup = verify();
    return cleanup;
  }, [reference, tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="container-page py-20 max-w-[480px]">
        <div className="card p-10 text-center">
          {state.kind === 'verifying' && (
            <>
              <Loader2 size={36} className="mx-auto mb-5 animate-spin text-accent" />
              <h1 className="text-[22px] font-bold tracking-tightest mb-2">
                Verifying your payment…
              </h1>
              <p className="text-[14px] text-ink-soft">
                Hold on a moment — we're confirming with Paystack.
              </p>
            </>
          )}

          {state.kind === 'timeout' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-honey-soft text-honey mb-5">
                <Clock size={26} strokeWidth={2} />
              </div>
              <h1 className="text-[22px] font-bold tracking-tightest mb-2">
                Taking longer than expected
              </h1>
              <p className="text-[14px] text-ink-soft mb-4">
                Paystack hasn't responded yet. This sometimes happens on slow connections.
              </p>
              <div className="bg-surface-alt rounded-lg p-4 text-left mb-7">
                <p className="text-[13px] font-semibold text-ink mb-1">What to do:</p>
                <ol className="text-[13px] text-ink-soft space-y-1 list-decimal list-inside">
                  <li>Click <strong className="text-ink">Try again</strong> — this usually resolves it.</li>
                  <li>If credits still don't appear, go to <strong className="text-ink">Billing</strong> and check your balance — it updates automatically within minutes of a successful payment.</li>
                  <li>Still missing? Email <a href="mailto:hello@acumen.app" className="text-accent underline underline-offset-2">hello@acumen.app</a> with your payment reference.</li>
                </ol>
                {reference && (
                  <p className="text-[11.5px] text-faint mt-3 font-mono break-all">
                    Ref: {reference}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                <Button variant="primary" size="lg" className="w-full" onClick={verify}>
                  Try again
                </Button>
                <Button asChild variant="secondary" size="md" className="w-full">
                  <Link to={`/${tenantSlug}/billing`}>Check my balance on billing →</Link>
                </Button>
              </div>
            </>
          )}

          {state.kind === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sage-soft text-sage mb-5">
                <Check size={26} strokeWidth={2.5} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sage mb-2 block">
                — Payment received —
              </span>
              <h1 className="text-[26px] font-bold tracking-tightest mb-3">
                +{state.uploads} uploads added
              </h1>
              <p className="text-[14.5px] text-ink-soft mb-2">
                Your <strong className="text-ink capitalize">{state.pack}</strong> pack has been
                credited to your workspace.
              </p>
              {typeof state.balance === 'number' && (
                <p className="text-[14px] text-muted mb-7">
                  New balance:{' '}
                  <strong className="text-accent text-[16px]">{state.balance}</strong> uploads
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                <Button asChild variant="primary" size="lg" className="w-full">
                  <Link to={`/${tenantSlug}/upload`}>Upload your first file →</Link>
                </Button>
                <Button asChild variant="ghost" size="md" className="w-full">
                  <Link to={`/${tenantSlug}/dashboard`}>Back to dashboard</Link>
                </Button>
              </div>
              <p className="text-[12px] text-faint mt-6 break-all">
                Receipt sent to{' '}
                <span className="font-medium">{me?.user.email ?? 'your email'}</span>
                {' '}· Ref: {state.reference}
              </p>
            </>
          )}

          {state.kind === 'failed' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-coral-soft text-coral mb-5">
                <X size={26} strokeWidth={2.5} />
              </div>
              <h1 className="text-[24px] font-bold tracking-tightest mb-3">
                Payment {state.reason === 'abandoned' ? 'cancelled' : 'failed'}
              </h1>
              <p className="text-[14.5px] text-ink-soft mb-7">
                {state.reason === 'abandoned'
                  ? 'No charge was made. You can try again anytime.'
                  : 'Something went wrong on the payment side. No credits were added.'}
              </p>
              <div className="flex flex-col gap-2.5">
                <Button asChild variant="primary" size="lg" className="w-full">
                  <Link to={`/${tenantSlug}/billing`}>Try again</Link>
                </Button>
                <Button asChild variant="ghost" size="md" className="w-full">
                  <Link to={`/${tenantSlug}/dashboard`}>Back to dashboard</Link>
                </Button>
              </div>
            </>
          )}

          {state.kind === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-coral-soft text-coral mb-5">
                <X size={26} strokeWidth={2.5} />
              </div>
              <h1 className="text-[22px] font-bold tracking-tightest mb-3">
                Couldn't verify payment
              </h1>
              <p className="text-[14px] text-ink-soft mb-7">{state.message}</p>
              <Button asChild variant="primary" size="lg" className="w-full">
                <Link to={`/${tenantSlug}/billing`}>Back to billing</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
