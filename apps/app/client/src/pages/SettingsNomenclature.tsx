import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { apiClient } from '@/lib/api';
import { Trash2, Tag } from 'lucide-react';

interface Entry {
  id: string;
  syllabusCode: string;
  syllabusName: string;
}

export default function SettingsNomenclature() {
  const { tenantSlug } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['nomenclature', tenantSlug],
    queryFn: () =>
      apiClient.get<{ entries: Entry[] }>(`/api/t/${tenantSlug}/nomenclature/syllabus`),
    enabled: !!tenantSlug,
  });

  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/t/${tenantSlug}/nomenclature/syllabus`, {
        syllabusCode: code,
        syllabusName: name,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomenclature', tenantSlug] });
      setCode('');
      setName('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/t/${tenantSlug}/nomenclature/syllabus/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nomenclature', tenantSlug] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <SettingsLayout>
      <div className="mb-6">
        <h2 className="text-[22px] font-bold tracking-tighter mb-1">Syllabus nomenclature</h2>
        <p className="text-[14px] text-ink-soft max-w-[560px]">
          Map Cambridge syllabus codes to readable names (e.g. <code>0580 → Mathematics</code>).
          Saved names show across every dashboard.
        </p>
      </div>

      {/* Inline add form */}
      <form
        onSubmit={handleSubmit}
        className="card p-5 mb-8 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <div className="sm:w-[140px]">
          <Label>Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="0580"
            required
          />
        </div>
        <div className="flex-1">
          <Label>Subject name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mathematics"
            required
          />
        </div>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add mapping'}
        </Button>
      </form>

      {!data?.entries.length ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sage-soft text-sage mb-4">
            <Tag size={22} />
          </div>
          <h3 className="text-[16px] font-semibold mb-2">No mappings yet</h3>
          <p className="text-[14px] text-ink-soft">
            Add your first mapping above. Acumen ships with a default Cambridge code map for
            common subjects.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[14px]">
            <thead className="bg-surface-alt border-b border-border">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Subject name</th>
                <th className="px-5 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-b border-border-soft last:border-0">
                  <td className="px-5 py-3.5">
                    <code className="text-[13px] font-semibold bg-surface-alt px-2 py-0.5 rounded">
                      {e.syllabusCode}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 font-semibold">{e.syllabusName}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${e.syllabusCode} → ${e.syllabusName}?`)) {
                          remove.mutate(e.id);
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
