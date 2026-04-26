import { useState, useRef, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { apiClient, ApiError } from '@/lib/api';
import { UploadCloud, FileSpreadsheet, X, Check, AlertTriangle, Trash2 } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const YEARS = Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - i);

interface UploadRow {
  id: string;
  fileName: string;
  examType: 'IGCSE' | 'A Level';
  month: string;
  year: number;
  recordCount: number;
  status: 'processing' | 'processed' | 'failed';
  fileFormat: string;
  createdAt: string;
}

export default function Upload() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [examType, setExamType] = useState<'IGCSE' | 'A Level'>('IGCSE');
  const [month, setMonth] = useState('June');
  const [year, setYear] = useState(new Date().getFullYear());
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: list, refetch } = useQuery({
    queryKey: ['uploads', tenantSlug],
    queryFn: () => apiClient.get<{ uploads: UploadRow[] }>(`/api/t/${tenantSlug}/uploads`),
    enabled: !!tenantSlug,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Pick a file first');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('examType', examType);
      fd.append('month', month);
      fd.append('year', String(year));
      const res = await fetch(`/api/t/${tenantSlug}/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error ?? 'Upload failed');
      }
      return res.json() as Promise<{
        rowsParsed: number;
        balanceAfter: number;
        format: string;
      }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantSlug] });
      qc.invalidateQueries({ queryKey: ['billing-balance', tenantSlug] });
      refetch();
      setFile(null);
      // Bounce to analytics
      navigate(
        `/${tenantSlug}/analytics/${examType === 'IGCSE' ? 'igcse' : 'alevel'}?from=upload`
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && (err as any).status === 402) {
        setError('You have no upload credits left. Top up to continue.');
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
  });

  const deleteUpload = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/t/${tenantSlug}/uploads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant', tenantSlug] });
      refetch();
    },
  });

  function handleDrag(e: DragEvent, on: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(on);
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }
  function handleFile(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      setError('File exceeds 10MB');
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      setError('Only .xlsx and .xls files are supported');
      return;
    }
    setError(null);
    setFile(f);
  }
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError('Pick a file first');
    upload.mutate();
  }

  return (
    <AppShell>
      <div className="container-page py-10">
        <div className="mb-10 max-w-[640px]">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            — Upload
          </span>
          <h1 className="text-[32px] font-bold tracking-tightest leading-[1.1] mt-2 mb-3">
            Upload exam results
          </h1>
          <p className="text-[15px] text-ink-soft leading-relaxed">
            Drop a Cambridge IGCSE or A Level Excel file. Acumen detects the format
            automatically — comprehensive (multi-sheet) or summary (single-sheet) — and parses
            every row in under thirty seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Drop zone */}
          <div className="lg:col-span-2">
            <div
              onDragEnter={(e) => handleDrag(e, true)}
              onDragLeave={(e) => handleDrag(e, false)}
              onDragOver={(e) => handleDrag(e, true)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`card p-10 text-center transition-colors cursor-pointer
                ${dragActive ? 'border-accent bg-accent-soft/30' : ''}
                ${file ? 'cursor-default' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {!file ? (
                <>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-soft text-accent mb-4">
                    <UploadCloud size={26} />
                  </div>
                  <h3 className="text-[18px] font-semibold tracking-tight mb-1.5">
                    {dragActive ? 'Drop the file here' : 'Drag & drop your results file'}
                  </h3>
                  <p className="text-[14px] text-muted mb-1">
                    or <span className="text-ink underline underline-offset-2">click to browse</span>
                  </p>
                  <p className="text-[12.5px] text-faint mt-3">
                    .xlsx or .xls · up to 10MB · 1 credit per file
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-md bg-sage-soft text-sage flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[14.5px] text-ink truncate">
                        {file.name}
                      </div>
                      <div className="text-[12.5px] text-muted">
                        {(file.size / 1024).toFixed(1)} KB · ready to upload
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-muted hover:text-ink p-2"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-[13px] text-coral bg-coral-soft rounded px-3 py-2.5">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
                {error.includes('credits') && (
                  <Link
                    to={`/${tenantSlug}/billing`}
                    className="ml-auto font-semibold underline underline-offset-2"
                  >
                    Top up →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Metadata sidebar */}
          <div className="card p-6">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-5">
              Exam details
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Exam type</Label>
                <div className="flex gap-2">
                  {(['IGCSE', 'A Level'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setExamType(t)}
                      className={`flex-1 px-3 py-2.5 rounded text-[13.5px] font-semibold border transition-colors
                        ${examType === t
                          ? 'border-ink bg-ink text-bg'
                          : 'border-border bg-surface text-ink hover:border-ink'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="month">Month</Label>
                  <select
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="input-base appearance-none cursor-pointer pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 14px center',
                    }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <select
                    id="year"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="input-base appearance-none cursor-pointer pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 5 6 8 9 5'/></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 14px center',
                    }}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full mt-2"
                disabled={!file || upload.isPending}
              >
                {upload.isPending ? 'Parsing…' : 'Upload & analyze →'}
              </Button>
              <p className="text-[11.5px] text-faint text-center">
                Charges 1 upload credit on success.
              </p>
            </div>
          </div>
        </form>

        {/* Recent uploads */}
        <div>
          <h2 className="text-[20px] font-bold tracking-tighter mb-5">Recent uploads</h2>
          {!list?.uploads.length ? (
            <div className="card p-10 text-center text-muted">
              No uploads yet. Drop a file above to get started.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-[14px]">
                <thead className="bg-surface-alt border-b border-border">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">File</th>
                    <th className="px-5 py-3">Exam</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3 text-right">Records</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Uploaded</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.uploads.map((u) => (
                    <tr key={u.id} className="border-b border-border-soft last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet size={16} className="text-muted flex-shrink-0" />
                          <span className="font-semibold truncate">{u.fileName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">{u.examType}</td>
                      <td className="px-5 py-3 text-ink-soft">
                        {u.month} {u.year}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {u.recordCount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-5 py-3 text-right text-muted text-[12.5px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${u.fileName}? Your credit will be refunded.`)) {
                              deleteUpload.mutate(u.id);
                            }
                          }}
                          className="text-muted hover:text-coral p-1.5 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: 'processing' | 'processed' | 'failed' }) {
  const map = {
    processing: { bg: '#FEF3C7', fg: '#CA8A04', label: 'Processing' },
    processed: { bg: '#BBF7D0', fg: '#166534', label: 'Processed', icon: <Check size={11} /> },
    failed: { bg: '#FBCFE8', fg: '#BE185D', label: 'Failed' },
  } as const;
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.fg }}
    >
      {('icon' in s && s.icon) || null}
      {s.label}
    </span>
  );
}
