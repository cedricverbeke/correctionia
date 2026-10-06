import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Eye,
  Pencil,
  Download,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Star,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Save,
  Check,
  FileSpreadsheet,
  Inbox,
  Clock,
  ClipboardList,
  Trash2,
  Loader2,
  Sparkles,
  RefreshCw,
  Keyboard,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ValidationBadge, AiStatusBadge } from '@/components/ui/Badges';
import { fetchSubmissions, updateSubmission, deleteSubmission, deleteAllSubmissions, triggerAnalysis, fetchGeminiModel, updateGeminiModel } from '@/lib/api';
import { ManualAnalysisModal } from '@/components/ManualAnalysisModal';
import type { Submission, ValidationStatus } from '@/types';

function getAttachedFiles(sub: Submission): { name: string; url: string }[] {
  if (!sub.file_url) return [];
  try {
    const parsed = JSON.parse(sub.file_name || '');
    if (Array.isArray(parsed)) {
      return parsed.map((f: { name: string; url: string }) => ({ name: f.name, url: f.url }));
    }
  } catch {
    // not JSON, single file
  }
  return [{ name: sub.file_name || 'Fichier', url: sub.file_url }];
}

export function TeacherDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ValidationStatus>('all');
  const [editing, setEditing] = useState<Submission | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editPointsForts, setEditPointsForts] = useState('');
  const [editAxesAmelioration, setEditAxesAmelioration] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [analysisMsg, setAnalysisMsg] = useState<string | null>(null);
  const [manualSub, setManualSub] = useState<Submission | null>(null);
  const [viewingFiles, setViewingFiles] = useState<Submission | null>(null);
  const [geminiModel, setGeminiModel] = useState('gemini-3.5-flash-lite');
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMsg, setModelMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchGeminiModel().then(setGeminiModel).catch(() => {});
  }, []);

  const handleModelChange = async (value: string) => {
    setGeminiModel(value);
    setModelSaving(true);
    setModelMsg(null);
    try {
      await updateGeminiModel(value);
      setModelMsg('Modèle mis à jour.');
      setTimeout(() => setModelMsg(null), 3000);
    } catch {
      setModelMsg('Erreur lors de la mise à jour.');
    } finally {
      setModelSaving(false);
    }
  };

  const load = () => {
    fetchSubmissions()
      .then(setSubmissions)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchesSearch =
        s.student_name.toLowerCase().includes(search.toLowerCase()) ||
        s.exercise_title.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.validation_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [submissions, search, statusFilter]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const aRelire = submissions.filter((s) => s.validation_status === 'a_relire').length;
    const valide = submissions.filter((s) => s.validation_status === 'valide').length;
    const graded = submissions.filter((s) => s.ai_note !== null);
    const avgNote = graded.reduce((sum, s) => sum + (s.ai_note || 0), 0) / (graded.length || 1);
    return { total, aRelire, valide, avgNote };
  }, [submissions]);

  const openEdit = (sub: Submission) => {
    setEditing(sub);
    setEditNote(String(sub.final_note ?? sub.ai_note ?? ''));
    setEditComment(sub.final_comment ?? sub.ai_commentaire ?? '');
    setEditDetail(sub.ai_detail ?? '');
    setEditPointsForts((sub.ai_points_forts || []).join('\n'));
    setEditAxesAmelioration((sub.ai_axes_amelioration || []).join('\n'));
  };

  const handleSave = async (markAsValidated: boolean) => {
    if (!editing) return;
    setSaving(true);
    try {
      const newStatus: ValidationStatus = markAsValidated ? 'valide' : 'modifie';
      await updateSubmission(editing.id, {
        final_note: parseFloat(editNote) || null,
        final_comment: editComment.trim() || null,
        ai_detail: editDetail,
        ai_points_forts: editPointsForts.split('\n').map((l) => l.trim()).filter(Boolean),
        ai_axes_amelioration: editAxesAmelioration.split('\n').map((l) => l.trim()).filter(Boolean),
        validation_status: newStatus,
      });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (sub: Submission) => {
    if (!confirm(`Supprimer la soumission de ${sub.student_name} pour « ${sub.exercise_title} » ?`)) return;
    setDeletingId(sub.id);
    try {
      await deleteSubmission(sub.id);
      load();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurgeAll = async () => {
    if (submissions.length === 0) return;
    if (!confirm(`Supprimer TOUTES les ${submissions.length} soumissions ? Cette action est irréversible et supprimera aussi les fichiers.`)) return;
    if (!confirm('Confirmation finale : toutes les notes, commentaires et fichiers seront définitivement supprimés.')) return;
    setPurging(true);
    try {
      await deleteAllSubmissions();
      load();
    } catch {
      // ignore
    } finally {
      setPurging(false);
    }
  };

  const handleAnalyzeOne = async (sub: Submission) => {
    setAnalyzingId(sub.id);
    setAnalysisMsg(null);
    try {
      await updateSubmission(sub.id, { ai_status: 'pending' });
      load();
      await triggerAnalysis(
        sub.id,
        sub.assignment_id,
        sub.exercise_title,
        sub.text_answer,
        sub.file_url,
        sub.file_type,
        sub.file_name,
      );
      load();
      setAnalysisMsg(`Analyse lancée pour ${sub.student_name} — « ${sub.exercise_title} ».`);
    } catch (err) {
      setAnalysisMsg(err instanceof Error ? err.message : 'L\'analyse a échoué.');
      load();
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalyzeAll = async () => {
    const pending = submissions.filter((s) => s.ai_status === 'pending' || s.ai_status === 'failed');
    if (pending.length === 0) {
      setAnalysisMsg('Aucune soumission en attente ou en échec à réanalyser.');
      return;
    }
    setBulkAnalyzing(true);
    setAnalysisMsg(null);
    let ok = 0;
    let fail = 0;
    for (const sub of pending) {
      try {
        await updateSubmission(sub.id, { ai_status: 'pending' });
        await triggerAnalysis(
          sub.id,
          sub.assignment_id,
          sub.exercise_title,
          sub.text_answer,
          sub.file_url,
          sub.file_type,
          sub.file_name,
        );
        ok++;
        if (pending.indexOf(sub) < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 12000));
        }
      } catch {
        fail++;
      }
    }
    load();
    setBulkAnalyzing(false);
    if (fail === 0) {
      setAnalysisMsg(`${ok} soumission(s) analysée(s) avec succès.`);
    } else {
      setAnalysisMsg(`${ok} réussie(s), ${fail} échec(s) sur ${pending.length} soumission(s).`);
    }
  };

  const handleExportCSV = () => {
    setExporting(true);
    const headers = ['Date', 'Élève', 'Devoir', 'Note IA', 'Note finale', 'Statut', 'Points forts', 'Axes d\u2019am\u00e9lioration', 'Commentaire', 'Correction d\u00e9taill\u00e9e'];
    const rows = filtered.map((s) => [
      new Date(s.created_at).toLocaleString('fr-FR'),
      s.student_name, s.exercise_title,
      s.ai_note?.toString() ?? '', s.final_note?.toString() ?? '',
      s.validation_status,
      (s.ai_points_forts || []).join('; '),
      (s.ai_axes_amelioration || []).join('; '),
      (s.final_comment ?? s.ai_commentaire ?? '').replace(/\n/g, ' '),
      (s.ai_detail ?? '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `devoirs_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const handleGoogleSheetsExport = () => {
    setExporting(true); setExportMsg(null);
    const headers = ['Date', 'Élève', 'Devoir', 'Note IA', 'Note finale', 'Statut', 'Points forts', 'Axes d\u2019am\u00e9lioration', 'Commentaire'];
    const rows = filtered.map((s) => [
      new Date(s.created_at).toLocaleString('fr-FR'),
      s.student_name, s.exercise_title,
      s.ai_note?.toString() ?? '', s.final_note?.toString() ?? '',
      s.validation_status,
      (s.ai_points_forts || []).join('; '),
      (s.ai_axes_amelioration || []).join('; '),
      (s.final_comment ?? s.ai_commentaire ?? '').replace(/\n/g, ' '),
    ]);
    const tsv = [headers, ...rows].map((r) => r.map((c) => String(c).replace(/\t/g, ' ')).join('\t')).join('\n');
    navigator.clipboard.writeText(tsv)
      .then(() => {
        setExportMsg('Donn\u00e9es copi\u00e9es ! Collez-les dans Google Sheets (Ctrl+V).');
        window.open('https://docs.google.com/spreadsheets/create', '_blank');
      })
      .catch(() => setExportMsg('Copie impossible. Utilisez l\u2019export CSV.'))
      .finally(() => setExporting(false));
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total devoirs" value={stats.total} icon={Inbox} color="brand" />
        <StatCard label="À relire" value={stats.aRelire} icon={Clock} color="amber" />
        <StatCard label="Validés" value={stats.valide} icon={Check} color="emerald" />
        <StatCard label="Note moyenne" value={stats.avgNote ? `${stats.avgNote.toFixed(1)}/20` : '—'} icon={Star} color="brand" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par élève ou devoir…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ValidationStatus)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all">
          <option value="all">Tous les statuts</option>
          <option value="a_relire">À relire</option>
          <option value="valide">Validé</option>
          <option value="modifie">Modifié</option>
        </select>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={geminiModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={modelSaving}
              title="Modèle Gemini utilisé pour l'analyse"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all disabled:opacity-50 cursor-pointer"
            >
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
              <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
              <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
            </select>
            {modelSaving && <Loader2 className="w-3 h-3 animate-spin absolute -right-1 -top-1 text-brand-500" />}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={handleAnalyzeAll}
            loading={bulkAnalyzing}
          >
            <Sparkles className="w-4 h-4" /> Lancer l'analyse IA
          </Button>
          <Button variant="secondary" size="md" onClick={handleExportCSV} loading={exporting}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="primary" size="md" onClick={handleGoogleSheetsExport} loading={exporting}>
            <FileSpreadsheet className="w-4 h-4" /> Google Sheets
          </Button>
        </div>
      </div>

      {modelMsg && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-600 text-xs animate-slide-down">
          {modelMsg}
        </div>
      )}

      {exportMsg && (
        <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-sm animate-slide-down">{exportMsg}</div>
      )}

      {analysisMsg && (
        <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-sm animate-slide-down">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{analysisMsg}</span>
            <button onClick={() => setAnalysisMsg(null)} className="ml-auto text-brand-400 hover:text-brand-600">
              ×
            </button>
          </div>
        </div>
      )}

      {submissions.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handlePurgeAll}
            disabled={purging}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:text-slate-300 transition-colors"
          >
            {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Purger toutes les soumissions
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            Chargement des devoirs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucun devoir soumis</p>
            <p className="text-slate-400 text-sm mt-1">Les soumissions des élèves apparaîtront ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Élève</th>
                  <th className="px-4 py-3 whitespace-nowrap">Devoir</th>
                  <th className="px-4 py-3 whitespace-nowrap">Fichier</th>
                  <th className="px-4 py-3 whitespace-nowrap">Note IA</th>
                  <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      <br />
                      {new Date(sub.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{sub.student_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 truncate max-w-[180px]">{sub.exercise_title}</div>
                    </td>
                    <td className="px-4 py-3">
                      {sub.file_url ? (
                        (() => {
                          const files = getAttachedFiles(sub);
                          const allImages = files.every((f) => f.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i));
                          if (!allImages) {
                            return (
                              <a href={files[0].url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium">
                                <FileText className="w-4 h-4" />
                                <span className="text-xs underline">Voir{files.length > 1 ? ` (${files.length})` : ''}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            );
                          }
                          return (
                            <button
                              onClick={() => setViewingFiles(sub)}
                              className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 font-medium"
                            >
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-xs underline">Voir{files.length > 1 ? ` (${files.length})` : ''}</span>
                            </button>
                          );
                        })()
                      ) : sub.text_answer ? (
                        <span className="text-xs text-slate-400 italic">Texte saisi</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {sub.ai_status === 'pending' ? <AiStatusBadge status="pending" /> :
                       sub.ai_status === 'failed' ? <AiStatusBadge status="failed" /> : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg font-bold text-slate-900">{sub.final_note ?? sub.ai_note}</span>
                          <span className="text-xs text-slate-400">/20</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><ValidationBadge status={sub.validation_status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleAnalyzeOne(sub)}
                          disabled={analyzingId === sub.id || bulkAnalyzing}
                          className="p-2 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors disabled:opacity-50"
                          title="Lancer l'analyse IA (automatique)">
                          {analyzingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setManualSub(sub)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                          title="Analyse manuelle (copier / coller)">
                          <Keyboard className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(sub)}
                          className="p-2 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                          title="Valider / Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRow(sub)}
                          disabled={deletingId === sub.id}
                          className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Supprimer">
                          {deletingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)}
        title={editing ? `Correction — ${editing.student_name}` : ''} maxWidth="max-w-3xl">
        {editing && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Devoir</p>
              <p className="text-sm font-medium text-slate-700">{editing.exercise_title}</p>
            </div>

            {editing.ai_status === 'analyzed' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Star className="w-4 h-4 text-amber-400" /> Pré-correction IA
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Points forts
                    </div>
                    <textarea value={editPointsForts} onChange={(e) => setEditPointsForts(e.target.value)} rows={4}
                      className="w-full bg-transparent text-sm text-slate-700 focus:outline-none resize-y" />
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1.5">
                      <Lightbulb className="w-3.5 h-3.5" /> Axes d&apos;amélioration
                    </div>
                    <textarea value={editAxesAmelioration} onChange={(e) => setEditAxesAmelioration(e.target.value)} rows={4}
                      className="w-full bg-transparent text-sm text-slate-700 focus:outline-none resize-y" />
                  </div>
                </div>

                {editDetail && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                      <ClipboardList className="w-3.5 h-3.5" /> Correction détaillée
                    </div>
                    <textarea value={editDetail} onChange={(e) => setEditDetail(e.target.value)} rows={8}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y" />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Star className="w-4 h-4 text-amber-400" /> Note (sur 20)
              </label>
              <input type="number" step="0.5" min="0" max="20" value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <MessageSquare className="w-4 h-4 text-brand-500" /> Commentaire
              </label>
              <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y" />
            </div>

            {editing.file_url && (
              (() => {
                const files = getAttachedFiles(editing);
                const imageFiles = files.filter((f) => f.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i));
                const otherFiles = files.filter((f) => !f.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i));
                return (
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Eye className="w-4 h-4" /> {files.length > 1 ? `Copie de l'élève (${files.length} fichiers)` : 'Copie de l\'élève'}
                    </div>
                    {imageFiles.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        {imageFiles.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="group relative rounded-xl overflow-hidden border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all">
                            <img src={f.url} alt={`Page ${i + 1}`} className="w-full h-32 object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end p-2">
                              <span className="text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                Page {i + 1}
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {otherFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {otherFiles.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-brand-600 hover:text-brand-700 hover:border-brand-300 transition-all">
                            <FileText className="w-4 h-4" />
                            <span className="underline">Ouvrir le fichier</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
              <Button variant="success" onClick={() => handleSave(true)} loading={saving} fullWidth>
                <Check className="w-4 h-4" /> Valider la note
              </Button>
              <Button variant="secondary" onClick={() => handleSave(false)} loading={saving} fullWidth>
                <Save className="w-4 h-4" /> Enregistrer (modifié)
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Manual Analysis Modal */}
      <ManualAnalysisModal
        open={!!manualSub}
        onClose={() => setManualSub(null)}
        submission={manualSub}
        onSaved={load}
      />

      {/* File Viewer Modal */}
      <Modal
        open={!!viewingFiles}
        onClose={() => setViewingFiles(null)}
        title={viewingFiles ? `Copie de ${viewingFiles.student_name}` : ''}
        maxWidth="max-w-4xl"
      >
        {viewingFiles && (
          <FileViewer submission={viewingFiles} />
        )}
      </Modal>
    </div>
  );
}

function FileViewer({ submission }: { submission: Submission }) {
  const files = getAttachedFiles(submission);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (files.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Aucun fichier.</p>;
  }

  const current = files[currentIndex];
  const isImage = current.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i) !== null;
  const isPdf = current.url.match(/\.pdf$/i) !== null;

  return (
    <div className="space-y-4">
      {/* Image preview */}
      {isImage && (
        <div className="flex justify-center bg-slate-50 rounded-xl p-4 min-h-[300px]">
          <img
            src={current.url}
            alt={`Page ${currentIndex + 1}`}
            className="max-h-[60vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* PDF: open in new tab directly */}
      {isPdf && (
        <div className="flex flex-col items-center justify-center text-slate-400 py-12 bg-slate-50 rounded-xl">
          <FileText className="w-12 h-12 mb-3" />
          <p className="text-sm mb-3">Fichier PDF — ouvrez-le dans un nouvel onglet.</p>
          <a href={current.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <ExternalLink className="w-4 h-4" /> Ouvrir le PDF
          </a>
        </div>
      )}

      {/* Other non-image files */}
      {!isImage && !isPdf && (
        <div className="flex flex-col items-center justify-center text-slate-400 py-12 bg-slate-50 rounded-xl">
          <FileText className="w-12 h-12 mb-3" />
          <p className="text-sm mb-3">Ce fichier n'est pas une image.</p>
          <a href={current.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            <Download className="w-4 h-4" /> Télécharger / Ouvrir
          </a>
        </div>
      )}

      {/* Navigation */}
      {files.length > 1 && (
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Précédent
          </button>

          <div className="flex items-center gap-2">
            {/* Thumbnails */}
            <div className="flex gap-2">
              {files.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentIndex
                      ? 'border-brand-500 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-brand-300'
                  }`}
                >
                  {f.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i) ? (
                    <img src={f.url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500 font-medium whitespace-nowrap">
              {currentIndex + 1} / {files.length}
            </span>
          </div>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(files.length - 1, i + 1))}
            disabled={currentIndex === files.length - 1}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-brand-300 hover:text-brand-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Download current file */}
      <div className="flex justify-center pt-2 border-t border-slate-100">
        <a href={current.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors">
          <Download className="w-4 h-4" /> {files.length > 1 ? `Télécharger la page ${currentIndex + 1}` : 'Télécharger le fichier'}
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Inbox; color: 'brand' | 'amber' | 'emerald' }) {
  const colorMap = { brand: 'bg-brand-50 text-brand-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600' };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
