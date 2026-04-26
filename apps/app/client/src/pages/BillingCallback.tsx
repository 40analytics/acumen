import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiError } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, Loader2 } from 'lucide-react';

type State =
  | { kind: 'verifying' }
  | { kind: 'success'; uploads: number; pack: string; reference: string; balance?: number }
  | { kind: 'failed'; reason?: string }
  | { kind: 'error'; message: string };

export default function BillingCallback() {
  const { tenantSlug } = useParams();
  const [params] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ kind: 'verifying' });

  useEffect(() => {
    if (!reference || !tenantSlug) {
      setState({ kind: 'error', message: 'Missing payment reference.' });
      return;
    }
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
        if (cancelled) return;
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
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'Could not verify payment.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, tenantSlug, queryClient]);

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
                Receipt sent to your email · Ref: {state.reference}
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
