import { AppShell } from '@/components/AppShell';

export default function Placeholder({ title, body }: { title: string; body: string }) {
  return (
    <AppShell>
      <div className="container-page py-16">
        <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
          — {title}
        </span>
        <h1 className="text-[36px] font-bold tracking-tightest mt-2 mb-3">Coming soon</h1>
        <p className="text-[15px] text-ink-soft max-w-[520px]">{body}</p>
      </div>
    </AppShell>
  );
}
