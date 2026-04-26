import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { apiClient } from '@/lib/api';
import { Trash2, GraduationCap } from 'lucide-react';

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  department: string | null;
  position: string | null;
  isActive: boolean;
  subjects: { id: string; syllabusCode: string; examType: 'IGCSE' | 'A Level' }[];
}

export default function SettingsTeachers() {
  const { tenantSlug } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['teachers', tenantSlug],
    queryFn: () => apiClient.get<{ teachers: Teacher[] }>(`/api/t/${tenantSlug}/teachers`),
    enabled: !!tenantSlug,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/t/${tenantSlug}/teachers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teachers', tenantSlug] }),
  });

  return (
    <SettingsLayout>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-[22px] font-bold tracking-tighter mb-1">Teachers</h2>
          <p className="text-[14px] text-ink-soft">
            Maintain a directory and assign subjects so analytics can attribute performance.
          </p>
        </div>
        <NewTeacherDialog tenantSlug={tenantSlug!} />
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
          <table className="w-full text-[14px]">
            <thead className="bg-surface-alt border-b border-border">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Teacher</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Subjects</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t) => (
                <tr key={t.id} className="border-b border-border-soft last:border-0">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold">
                      {t.firstName} {t.lastName}
                    </div>
                    {t.position && (
                      <div className="text-[12.5px] text-muted">{t.position}</div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">{t.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-ink-soft">{t.department ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    {t.subjects.length === 0 ? (
                      <span className="text-faint text-[12.5px]">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {t.subjects.map((s) => (
                          <span
                            key={s.id}
                            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-honey-soft text-honey"
                          >
                            {s.syllabusCode} · {s.examType}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${t.firstName} ${t.lastName}?`)) {
                          remove.mutate(t.id);
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
    </SettingsLayout>
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
    },
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
