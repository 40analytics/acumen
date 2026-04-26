import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { useSession, signOut } from '@/lib/auth-client';
import { apiClient, ApiError } from '@/lib/api';
import { slugSchema } from '@acumen/shared';

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    if (slugTouched) return;
    setSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40)
    );
  }, [name, slugTouched]);

  useEffect(() => {
    if (!isPending && !session) navigate('/signin');
  }, [session, isPending, navigate]);

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
      const res = await apiClient.post<{ tenant: { slug: string } }>('/api/tenants', {
        name: name.trim(),
        slug,
      });
      navigate(`/${res.tenant.slug}/dashboard`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isPending) return null;

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
        <div className="w-full max-w-[460px]">
          <div className="mb-8">
            <span className="eyebrow-pill mb-5">Step 1 of 1</span>
            <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mb-3">
              Create your school
            </h1>
            <p className="text-[15px] text-ink-soft leading-relaxed">
              This is the workspace your team will share. You can invite colleagues after.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card p-7 space-y-5">
            <div>
              <Label htmlFor="name">School name</Label>
              <Input
                id="name"
                placeholder="Heritage International School"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              disabled={submitting || !name || !slug}
            >
              {submitting ? 'Creating…' : 'Create workspace →'}
            </Button>
          </form>

          <p className="text-[12.5px] text-muted text-center mt-5">
            Your first upload is free. No credit card needed.
          </p>
        </div>
      </main>
    </div>
  );
}
