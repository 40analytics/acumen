import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SettingsLayout } from '@/components/SettingsLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { Trash2, Tag, Upload, ArrowLeft, Check, Search } from 'lucide-react';

interface Entry {
  id: string;
  syllabusCode: string;
  syllabusName: string;
}

interface ParsedEntry {
  syllabusCode: string;
  syllabusName: string;
}

/** Parse a raw bulk-import text block into structured entries or an error list. */
function parseBulkText(raw: string): { entries: ParsedEntry[]; bad: string[] } {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: ParsedEntry[] = [];
  const bad: string[] = [];
  for (const line of lines) {
    const sep = line.includes(',') ? ',' : line.includes('\t') ? '\t' : ' - ';
    const idx = line.indexOf(sep);
    if (idx < 1) { bad.push(line); continue; }
    const syllabusCode = line.slice(0, idx).trim();
    const syllabusName = line.slice(idx + sep.length).trim();
    if (!syllabusCode || !syllabusName) { bad.push(line); continue; }
    entries.push({ syllabusCode, syllabusName });
  }
  return { entries, bad };
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
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<ParsedEntry[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [mappingSearch, setMappingSearch] = useState('');

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
      toast.success('Mapping saved');
    },
    onError: () => toast.error('Failed to save mapping'),
  });

  const bulkImport = useMutation({
    mutationFn: (entries: ParsedEntry[]) =>
      apiClient.post<{ imported: number }>(
        `/api/t/${tenantSlug}/nomenclature/syllabus/bulk`,
        { entries }
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['nomenclature', tenantSlug] });
      setBulkText('');
      setShowBulk(false);
      setPreviewEntries(null);
      toast.success(`${res.imported} mapping${res.imported !== 1 ? 's' : ''} imported`);
    },
    onError: () => toast.error('Bulk import failed — check your format and try again'),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/t/${tenantSlug}/nomenclature/syllabus/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nomenclature', tenantSlug] });
      setDeleteTarget(null);
    },
    onError: () => setDeleteTarget(null),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  /** Step 1: parse the text and show the preview table */
  function handleBulkPreview(e: FormEvent) {
    e.preventDefault();
    const { entries, bad } = parseBulkText(bulkText);
    if (bad.length > 0) {
      toast.error(
        `${bad.length} line${bad.length !== 1 ? 's' : ''} couldn't be parsed — use "CODE, Name" format`
      );
      return;
    }
    if (entries.length === 0) {
      toast.error('Nothing to import — add at least one line');
      return;
    }
    setPreviewEntries(entries);
  }

  /** Step 2: confirmed — fire the mutation */
  function handleBulkConfirm() {
    if (previewEntries) bulkImport.mutate(previewEntries);
  }

  function cancelBulk() {
    setBulkText('');
    setShowBulk(false);
    setPreviewEntries(null);
  }

  // Detect which codes already exist so we can flag duplicates in preview
  const existingCodes = new Set((data?.entries ?? []).map((e) => e.syllabusCode));

  // Filtered entries for the mappings list
  const filteredEntries = (data?.entries ?? []).filter((e) => {
    if (!mappingSearch.trim()) return true;
    const q = mappingSearch.toLowerCase();
    return (
      e.syllabusCode.toLowerCase().includes(q) ||
      e.syllabusName.toLowerCase().includes(q)
    );
  });

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
        className="card p-5 mb-4 flex flex-col sm:flex-row gap-3 sm:items-end"
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

      {/* Bulk import */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => { setShowBulk((s) => !s); setPreviewEntries(null); }}
          className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink transition-colors"
        >
          <Upload size={14} />
          {showBulk ? 'Hide bulk import' : 'Bulk import from CSV / text'}
        </button>

        {showBulk && (
          <div className="card p-5 mt-3">
            {previewEntries === null ? (
              /* ── Step 1: paste textarea ── */
              <form onSubmit={handleBulkPreview}>
                <Label>
                  One mapping per line — format:{' '}
                  <code className="bg-surface-alt px-1.5 py-0.5 rounded text-[12px]">CODE, Subject name</code>
                </Label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"0580, Mathematics\n0620, Chemistry\n0500, English as a Second Language"}
                  rows={7}
                  className="w-full mt-2 px-3 py-2.5 rounded border border-border bg-surface text-[13.5px] font-mono text-ink placeholder-faint focus:outline-none focus:border-ink resize-y"
                  required
                />
                <div className="flex items-center gap-3 mt-3">
                  <Button type="submit">Preview import</Button>
                  <button
                    type="button"
                    onClick={cancelBulk}
                    className="text-[13px] text-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* ── Step 2: preview table ── */
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setPreviewEntries(null)}
                    className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Edit
                  </button>
                  <span className="text-[13.5px] font-semibold text-ink">
                    Preview — {previewEntries.length} mapping{previewEntries.length !== 1 ? 's' : ''} to import
                  </span>
                  {previewEntries.some((e) => existingCodes.has(e.syllabusCode)) && (
                    <span className="text-[12px] text-honey bg-honey-soft px-2 py-0.5 rounded font-semibold">
                      ⚠ Some codes will overwrite existing mappings
                    </span>
                  )}
                </div>

                <div className="border border-border rounded overflow-hidden mb-4">
                  <table className="w-full text-[13px]">
                    <thead className="bg-surface-alt border-b border-border">
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-muted">
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5">Subject name</th>
                        <th className="px-4 py-2.5 w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewEntries.map((entry, i) => {
                        const isUpdate = existingCodes.has(entry.syllabusCode);
                        return (
                          <tr
                            key={i}
                            className="border-t border-border-soft/60 first:border-0"
                          >
                            <td className="px-4 py-2.5">
                              <code className="text-[12px] font-semibold bg-surface-alt px-1.5 py-0.5 rounded">
                                {entry.syllabusCode}
                              </code>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-ink">
                              {entry.syllabusName}
                            </td>
                            <td className="px-4 py-2.5">
                              {isUpdate ? (
                                <span className="text-[11px] font-semibold text-honey bg-honey-soft px-1.5 py-0.5 rounded">
                                  Update
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-sage bg-sage-soft px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                  <Check size={10} strokeWidth={3} />
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleBulkConfirm}
                    disabled={bulkImport.isPending}
                    variant="primary"
                  >
                    {bulkImport.isPending ? 'Importing…' : `Confirm import (${previewEntries.length})`}
                  </Button>
                  <button
                    onClick={cancelBulk}
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
        <div>
          {/* Search bar */}
          {data.entries.length >= 6 && (
            <div className="relative mb-3">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
              />
              <input
                type="text"
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                placeholder="Search by code or subject name…"
                className="w-full pl-8 pr-4 py-2 rounded border border-border bg-surface text-[13.5px] text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors"
              />
            </div>
          )}

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
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-[13.5px] text-muted">
                      No mappings match "{mappingSearch}"
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border-soft last:border-0">
                      <td className="px-5 py-3.5">
                        <code className="text-[13px] font-semibold bg-surface-alt px-2 py-0.5 rounded">
                          {e.syllabusCode}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 font-semibold">{e.syllabusName}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setDeleteTarget(e)}
                          className="text-muted hover:text-coral p-1.5 rounded"
                          title="Remove mapping"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredEntries.length > 0 && mappingSearch && (
              <div className="px-5 py-2 bg-surface-alt border-t border-border-soft text-[12px] text-muted">
                {filteredEntries.length} of {data.entries.length} mappings
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remove mapping?"
        description={
          deleteTarget
            ? `Remove the mapping for ${deleteTarget.syllabusCode} → "${deleteTarget.syllabusName}"? This won't affect existing uploaded data.`
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
