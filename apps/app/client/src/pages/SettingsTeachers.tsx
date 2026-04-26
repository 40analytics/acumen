import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient, ApiError } from '@/lib/api';
import { Trash2, GraduationCap, ChevronDown, ChevronRight, Plus, X, Upload, ArrowLeft, BarChart2 } from 'lucide-react';

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  department: string | null;
  position: string | null;
  isActive: boolean;
  subjects: { id: string; syllabusCode: string; examType: 'IGCSE' | 'A Level'; isPrimaryTeacher: boolean }[];
}

interface BulkTeacherEntry {
  firstName: string;
  lastName: string;
  email?: string;
  department?: string;
  position?: string;
}

/** Parse CSV/TSV text into structured teacher entries */
function parseBulkTeachers(raw: string): { entries: BulkTeacherEntry[]; bad: string[] } {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: BulkTeacherEntry[] = [];
  const bad: string[] = [];
  for (const line of lines) {
    // Skip header rows
    if (/^first\s*name/i.test(line)) continue;
    const sep = line.includes('\t') ? '\t' : ',';
    const parts = line.split(sep).map((p) => p.trim());
    const [firstName, lastName, email, department, position] = parts;
    if (!firstName || !lastName) { bad.push(line); continue; }
    entries.push({
      firstName,
      lastName,
      email: email || undefined,
      department: department || undefined,
      position: position || undefined,
    });
  }
  return { entries, bad };
}

export default function SettingsTeachers() {
  const { tenantSlug } = useParams();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<BulkTeacherEntry[] | null>(null);

  const { data } = useQuery({
    queryKey: ['teachers', tenantSlug],
    queryFn: () => apiClient.get<{ teachers: Teacher[] }>(`/api/t/${tenantSlug}/teachers`),
    enabled: !!tenantSlug,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/t/${tenantSlug}/teachers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] });
      setDeleteTarget(null);
      toast.success('Teacher removed');
    },
    onError: () => {
      setDeleteTarget(null);
      toast.error('Failed to remove teacher');
    },
  });

  const bulkImport = useMutation({
    mutationFn: (entries: BulkTeacherEntry[]) =>
      apiClient.post<{ imported: number }>(`/api/t/${tenantSlug}/teachers/bulk`, {
        teachers: entries,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] });
      setBulkText('');
      setBulkPreview(null);
      setShowBulk(false);
      toast.success(`${res.imported} teacher${res.imported !== 1 ? 's' : ''} imported`);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Bulk import failed'),
  });

  function handleBulkPreview(e: FormEvent) {
    e.preventDefault();
    const { entries, bad } = parseBulkTeachers(bulkText);
    if (bad.length > 0) {
      toast.error(`${bad.length} line${bad.length !== 1 ? 's' : ''} couldn't be parsed — use "First, Last, email, dept, position"`);
      return;
    }
    if (entries.length === 0) {
      toast.error('Nothing to import — add at least one row');
      return;
    }
    setBulkPreview(entries);
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <SettingsLayout>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tighter mb-1">Teachers</h2>
          <p className="text-[14px] text-ink-soft">
            Maintain a directory and assign subjects so analytics can attribute performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/${tenantSlug}/analytics/teachers`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink border border-border rounded px-3 py-2 hover:border-ink transition-colors"
          >
            <BarChart2 size={14} />
            View analytics
          </Link>
          <NewTeacherDialog tenantSlug={tenantSlug!} />
        </div>
      </div>

      {/* Bulk import toggle */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => { setShowBulk((s) => !s); setBulkPreview(null); setBulkText(''); }}
          className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink transition-colors"
        >
          <Upload size={14} />
          {showBulk ? 'Hide bulk import' : 'Bulk import teachers from CSV'}
        </button>

        {showBulk && (
          <div className="card p-5 mt-3">
            {bulkPreview === null ? (
              <form onSubmit={handleBulkPreview}>
                <Label>
                  One teacher per line —{' '}
                  <code className="bg-surface-alt px-1.5 py-0.5 rounded text-[12px]">
                    First name, Last name, Email, Department, Position
                  </code>{' '}
                  (last 3 optional)
                </Label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Alice, Johnson, alice@school.edu, Sciences, Head of Chemistry\nBob, Smith,,, Mathematics Teacher"}
                  rows={6}
                  className="w-full mt-2 px-3 py-2.5 rounded border border-border bg-surface text-[13.5px] font-mono text-ink placeholder-faint focus:outline-none focus:border-ink resize-y"
                  required
                />
                <div className="flex items-center gap-3 mt-3">
                  <Button type="submit">Preview import</Button>
                  <button
                    type="button"
                    onClick={() => { setShowBulk(false); setBulkText(''); }}
                    className="text-[13px] text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setBulkPreview(null)}
                    className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
                  >
                    <ArrowLeft size={13} />
                    Edit
                  </button>
                  <span className="text-[13.5px] font-semibold text-ink">
                    Preview — {bulkPreview.length} teacher{bulkPreview.length !== 1 ? 's' : ''} to import
                  </span>
                </div>
                <div className="border border-border rounded overflow-hidden mb-4">
                  <table className="w-full text-[13px]">
                    <thead className="bg-surface-alt border-b border-border">
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Department</th>
                        <th className="px-4 py-2.5">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((t, i) => (
                        <tr key={i} className="border-t border-border-soft/60 first:border-0">
                          <td className="px-4 py-2.5 font-semibold">
                            {t.firstName} {t.lastName}
                          </td>
                          <td className="px-4 py-2.5 text-ink-soft">{t.email ?? '—'}</td>
                          <td className="px-4 py-2.5 text-ink-soft">{t.department ?? '—'}</td>
                          <td className="px-4 py-2.5 text-ink-soft">{t.position ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => bulkImport.mutate(bulkPreview)}
                    disabled={bulkImport.isPending}
                    variant="primary"
                  >
                    {bulkImport.isPending
                      ? 'Importing…'
                      : `Confirm import (${bulkPreview.length})`}
                  </Button>
                  <button
                    onClick={() => { setBulkPreview(null); setShowBulk(false); setBulkText(''); }}
                    className="text-[13px] text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!data?.teachers.length ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-honey-soft text-honey mb-4">
            <GraduationCap size={22} />
          </div>
          <h3 className="text-[16px] font-semibold mb-2">No teachers yet</h3>
          <p className="text-[14px] text-ink-soft mb-5">
            Add your first teacher to start mapping subject ownership.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {[...data.teachers]
            .sort((a, b) =>
              `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
            )
            .map((t, idx) => (
            <div
              key={t.id}
              className={idx < data.teachers.length - 1 ? 'border-b border-border-soft' : ''}
            >
              {/* Main row */}
              <div className="flex items-center px-5 py-3.5 gap-3">
                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(t.id)}
                  className="text-muted hover:text-ink p-0.5 flex-shrink-0 transition-colors"
                  title={expandedId === t.id ? 'Collapse' : 'Manage subjects'}
                >
                  {expandedId === t.id ? (
                    <ChevronDown size={15} />
                  ) : (
                    <ChevronRight size={15} />
                  )}
                </button>

                {/* Name + meta */}
                <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_1fr_auto] gap-x-4 items-center text-[14px]">
                  <div>
                    <div className="font-semibold text-ink">
                      {t.firstName} {t.lastName}
                    </div>
                    {t.position && (
                      <div className="text-[12.5px] text-muted">{t.position}</div>
                    )}
                  </div>
                  <div className="text-ink-soft truncate">{t.email ?? '—'}</div>
                  <div className="text-ink-soft truncate">{t.department ?? '—'}</div>
                  <div className="flex items-center gap-2">
                    {/* Subject pill count */}
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded bg-honey-soft text-honey">
                      {t.subjects.length} subject{t.subjects.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="text-muted hover:text-coral p-1.5 rounded transition-colors"
                      title="Remove teacher"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded subject panel */}
              {expandedId === t.id && (
                <div className="bg-surface-alt border-t border-border-soft px-8 py-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[13px] font-semibold text-ink uppercase tracking-wider">
                      Subject assignments
                    </h4>
                    <AddSubjectInline teacherId={t.id} tenantSlug={tenantSlug!} />
                  </div>

                  {t.subjects.length === 0 ? (
                    <p className="text-[13.5px] text-muted py-2">
                      No subjects assigned yet. Add one above to link this teacher to analytics data.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {t.subjects.map((s) => (
                        <SubjectChip
                          key={s.id}
                          subject={s}
                          teacherId={t.id}
                          tenantSlug={tenantSlug!}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remove teacher?"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.firstName} ${deleteTarget.lastName} from the directory? Their subject assignments will also be removed.`
            : ''
        }
        confirmLabel="Remove"
        variant="danger"
        isPending={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </SettingsLayout>
  );
}

/** Inline chip showing a subject with a remove button */
function SubjectChip({
  subject,
  teacherId,
  tenantSlug,
}: {
  subject: { id: string; syllabusCode: string; examType: 'IGCSE' | 'A Level'; isPrimaryTeacher: boolean };
  teacherId: string;
  tenantSlug: string;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () =>
      apiClient.delete(`/api/t/${tenantSlug}/teachers/${teacherId}/subjects/${subject.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] });
    },
    onError: () => toast.error('Failed to remove subject'),
  });

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold pl-2.5 pr-1.5 py-1 rounded-full bg-surface border border-border text-ink">
      <span>{subject.syllabusCode}</span>
      <span className="text-muted font-normal">·</span>
      <span className="text-muted font-normal">{subject.examType}</span>
      {subject.isPrimaryTeacher && (
        <span className="text-[10px] font-bold text-honey ml-0.5">★</span>
      )}
      <button
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="ml-0.5 text-muted hover:text-coral rounded-full p-0.5 transition-colors disabled:opacity-40"
        title="Remove subject"
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </span>
  );
}

/** Inline "add subject" form shown inside the expanded row */
function AddSubjectInline({
  teacherId,
  tenantSlug,
}: {
  teacherId: string;
  tenantSlug: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [examType, setExamType] = useState<'IGCSE' | 'A Level'>('IGCSE');
  const [isPrimary, setIsPrimary] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/t/${tenantSlug}/teachers/${teacherId}/subjects`, {
        syllabusCode: code.trim(),
        examType,
        isPrimaryTeacher: isPrimary,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] });
      setOpen(false);
      setCode('');
      setIsPrimary(false);
      toast.success('Subject assigned');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to assign subject'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    add.mutate();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline"
      >
        <Plus size={13} strokeWidth={2.5} />
        Add subject
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <Input
        autoFocus
        placeholder="Syllabus code e.g. 0580"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-40 text-[13px]"
        required
      />
      <select
        value={examType}
        onChange={(e) => setExamType(e.target.value as 'IGCSE' | 'A Level')}
        className="text-[13px] font-semibold border border-border rounded px-2 py-1.5 bg-surface cursor-pointer"
      >
        <option value="IGCSE">IGCSE</option>
        <option value="A Level">A Level</option>
      </select>
      <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          className="accent-ink"
        />
        Primary teacher
      </label>
      <Button type="submit" size="sm" variant="primary" disabled={add.isPending}>
        {add.isPending ? 'Adding…' : 'Add'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => { setOpen(false); setCode(''); }}
      >
        Cancel
      </Button>
    </form>
  );
}

function NewTeacherDialog({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/t/${tenantSlug}/teachers`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        department: form.department || null,
        position: form.position || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] });
      setOpen(false);
      setForm({ firstName: '', lastName: '', email: '', department: '', position: '' });
      toast.success('Teacher added');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add teacher'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">+ Add teacher</Button>
      </DialogTrigger>
      <DialogContent
        title="Add teacher"
        description="Subject assignments can be added after the teacher is created."
      >
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Sciences"
              />
            </div>
            <div>
              <Label>Position</Label>
              <Input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Head of Math"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Add teacher'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
