import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { apiClient, ApiError } from '@/lib/api';
import { Eye, EyeOff, Shield } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      await apiClient.post('/api/admin/auth/login', { username, password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not sign in. Check your credentials and try again.'
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Subtle background texture */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle, rgba(202,138,4,0.08) 0%, rgba(202,138,4,0) 70%)',
          }}
        />
      </div>

      <header className="container-page py-6">
        <Logo size="md" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center">
              <Shield size={24} className="text-bg" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-[28px] font-bold tracking-tightest leading-[1.1] mb-2">
              Admin portal
            </h1>
            <p className="text-[14.5px] text-ink-soft">
              Restricted access. Use your admin credentials.
            </p>
          </div>

          <div className="card p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={status === 'loading'}
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-[13px] text-coral bg-coral-soft border border-coral/20 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={status === 'loading' || !username || !password}
              >
                {status === 'loading' ? 'Signing in…' : 'Sign in to admin →'}
              </Button>
            </form>
          </div>

          <p className="text-center text-[12px] text-muted mt-5">
            Not an admin?{' '}
            <a href="/signin" className="text-ink hover:underline">
              Customer sign-in →
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
