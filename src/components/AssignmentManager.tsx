import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus,
  FileText,
  Upload,
  X,
  Save,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  FileCheck,
  BookOpen,
  Award,
  Lock,
  Unlock,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckSquare,
  Square,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  fetchAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  uploadAssignmentFile,
} from '@/lib/api';
import type { Assignment } from '@/types';

export function AssignmentManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enonceText, setEnonceText] = useState('');
  const [corrigeText, setCorrigeText] = useState('');
  const [baremeText, setBaremeText] = useState('');
  const [enonceFile, setEnonceFile] = useState<File | null>(null);
  const [corrigeFile, setCorrigeFile] = useState<File | null>(null);
  const [enonceUrl, setEnonceUrl] = useState<string | null>(null);
  const [enonceName, setEnonceName] = useState<string | null>(null);
  const [enoncePdfFile, setEnoncePdfFile] = useState<File | null>(null);
  const [enoncePdfUrl, setEnoncePdfUrl] = useState<string | null>(null);
  const [enoncePdfName, setEnoncePdfName] = useState<string | null>(null);
  const [corrigeUrl, setCorrigeUrl] = useState<string | null>(null);
  const [corrigeName, setCorrigeName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const enonceInputRef = useRef<HTMLInputElement>(null);
  const enoncePdfInputRef = useRef<HTMLInputElement>(null);
  const corrigeInputRef = useRef<HTMLInputElement>(null);

  const sortedAssignments = [...assignments].sort((a, b) => {
    const cmp = a.title.localeCompare(b.title, 'fr');
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const load = () => {
    fetchAssignments()
      .then(setAssignments)
      .catch(() => setError('Impossible de charger les devoirs.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setTitle(''); setDescription(''); setEnonceText(''); setCorrigeText(''); setBaremeText('');
    setDueDate('');
    setEnonceFile(null); setCorrigeFile(null);
    setEnoncePdfFile(null);
    setEnonceUrl(null); setEnonceName(null); setEnoncePdfUrl(null); setEnoncePdfName(null);
    setCorrigeUrl(null); setCorrigeName(null);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setTitle(a.title); setDescription(a.description || '');
    setEnonceText(a.enonce_text || ''); setCorrigeText(a.corrige_text || ''); setBaremeText(a.bareme_text || '');
    setDueDate(a.due_date ? new Date(a.due_date).toISOString().slice(0, 16) : '');
    setEnonceFile(null); setCorrigeFile(null); setEnoncePdfFile(null);
    setEnonceUrl(a.enonce_url); setEnonceName(a.enonce_name);
    setEnoncePdfUrl(a.enonce_pdf_url); setEnoncePdfName(a.enonce_pdf_name);
    setCorrigeUrl(a.corrige_url); setCorrigeName(a.corrige_name);
    setError('');
    setModalOpen(true);
  };

  const handleFileSelect = useCallback((file: File | null, type: 'enonce' | 'enonce_pdf' | 'corrige') => {
    if (!file) return;
    if (type === 'enonce') { setEnonceFile(file); setEnonceName(file.name); }
    else if (type === 'enonce_pdf') { setEnoncePdfFile(file); setEnoncePdfName(file.name); }
    else { setCorrigeFile(file); setCorrigeName(file.name); }
  }, []);

  const handleSave = async () => {
    if (!title.trim()) { setError('Le titre est obligatoire.'); return; }
    setSaving(true); setError('');

    try {
      let finalEnonceUrl = enonceUrl;
      let finalEnonceName = enonceName;
      let finalCorrigeUrl = corrigeUrl;
      let finalCorrigeName = corrigeName;

      if (enonceFile) {
        const uploaded = await uploadAssignmentFile(enonceFile);
        finalEnonceUrl = uploaded.url;
        finalEnonceName = uploaded.name;
      }
      if (corrigeFile) {
        const uploaded = await uploadAssignmentFile(corrigeFile);
        finalCorrigeUrl = uploaded.url;
        finalCorrigeName = uploaded.name;
      }

      let finalEnoncePdfUrl = enoncePdfUrl;
      let finalEnoncePdfName = enoncePdfName;
      if (enoncePdfFile) {
        const uploaded = await uploadAssignmentFile(enoncePdfFile);
        finalEnoncePdfUrl = uploaded.url;
        finalEnoncePdfName = uploaded.name;
      }

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        enonce_text: enonceText.trim() || null,
        corrige_text: corrigeText.trim() || null,
        bareme_text: baremeText.trim() || null,
        enonce_url: finalEnonceUrl,
        enonce_name: finalEnonceName,
        enonce_pdf_url: finalEnoncePdfUrl,
        enonce_pdf_name: finalEnoncePdfName,
        corrige_url: finalCorrigeUrl,
        corrige_name: finalCorrigeName,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };

      if (editing) {
        await updateAssignment(editing.id, payload);
      } else {
        await createAssignment({ ...payload, status: 'open' });
      }

      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (a: Assignment) => {
    const newStatus = a.status === 'open' ? 'closed' : 'open';
    await updateAssignment(a.id, { status: newStatus });
    load();
  };

  const handleDelete = async (a: Assignment) => {
    if (!confirm(`Supprimer le devoir "${a.title}" ?`)) return;
    await deleteAssignment(a.id);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedAssignments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedAssignments.map((a) => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} devoir(s) ? Cette action est irréversible.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteAssignment(id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      load();
    } catch {
      setError('Erreur lors de la suppression.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (assignments.length === 0) return;
    if (!confirm(`Supprimer TOUS les ${assignments.length} devoirs ? Cette action est irréversible.`)) return;
    if (!confirm('Êtes-vous absolument sûr ? Toutes les corrections et devoirs seront définitivement supprimés.')) return;
    setBulkDeleting(true);
    try {
      await Promise.all(assignments.map((a) => deleteAssignment(a.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      load();
    } catch {
      setError('Erreur lors de la suppression.');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gérer les devoirs</h2>
          <p className="text-sm text-slate-400">Créez les sujets, corrigés et barèmes pour l'IA.</p>
        </div>
        <div className="flex gap-2">
          {assignments.length > 0 && (
            <Button variant="secondary" size="md" onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
              {selectMode ? 'Terminer' : 'Sélectionner'}
            </Button>
          )}
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouveau devoir
          </Button>
        </div>
      </div>

      {/* Sort + bulk actions bar */}
      {assignments.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {sortOrder === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
            Trier par nom ({sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
          </button>
          {selectMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {selectedIds.size === sortedAssignments.length && sortedAssignments.length > 0
                  ? <CheckSquare className="w-4 h-4 text-brand-600" />
                  : <Square className="w-4 h-4" />}
                {selectedIds.size === sortedAssignments.length && sortedAssignments.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-slate-300 transition-colors font-medium"
              >
                {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement…
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun devoir créé</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">
            Créez votre premier devoir avec son énoncé, son corrigé et son barème.
          </p>
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Créer un devoir
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAssignments.map((a) => (
            <div
              key={a.id}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                selectMode && selectedIds.has(a.id) ? 'border-brand-400 bg-brand-50/30' : 'border-slate-200'
              }`}
            >
              {selectMode && (
                <button
                  onClick={() => toggleSelect(a.id)}
                  className="shrink-0 p-1"
                >
                  {selectedIds.has(a.id)
                    ? <CheckSquare className="w-5 h-5 text-brand-600" />
                    : <Square className="w-5 h-5 text-slate-300" />}
                </button>
              )}
              <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 truncate">{a.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.status === 'open'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {a.status === 'open' ? 'Ouvert' : 'Fermé'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  {a.enonce_text && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> Énoncé</span>}
                  {a.corrige_text && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> Corrigé</span>}
                  {a.bareme_text && <span className="flex items-center gap-1"><Award className="w-3 h-3" /> Barème</span>}
                  {a.enonce_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> Énoncé (.tex/PDF)</span>}
                  {a.enonce_pdf_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-sky-500" /> PDF élèves</span>}
                  {a.corrige_url && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF corrigé</span>}
                  {a.due_date && (
                    <span className={`flex items-center gap-1 ${new Date(a.due_date) < new Date() ? 'text-red-400' : 'text-amber-500'}`}>
                      <CalendarClock className="w-3 h-3" />
                      {new Date(a.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!selectMode && (<>
                  <button
                    onClick={() => handleToggleStatus(a)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                    title={a.status === 'open' ? 'Fermer' : 'Ouvrir'}
                  >
                    {a.status === 'open' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete all button */}
      {!loading && assignments.length > 0 && !selectMode && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleDeleteAll}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:text-slate-300 transition-colors"
          >
            {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Tout supprimer (fin d'année)
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier le devoir' : 'Nouveau devoir'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Titre *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: DS1 — Suites et séries"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Description (optionnel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Chapitres 1-3, durée 2h"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Énoncé — texte / .tex (pour l'IA) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileCheck className="w-4 h-4 text-brand-500" />
              Énoncé du devoir (texte ou .tex — utilisé par l'IA)
            </label>
            <textarea
              value={enonceText}
              onChange={(e) => setEnonceText(e.target.value)}
              rows={4}
              placeholder="Saisissez l'énoncé en texte, ou importez un fichier .tex ci-dessous…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y mb-2"
            />
            {enonceName ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <FileText className="w-4 h-4 text-brand-500" />
                <span className="text-sm text-slate-600 flex-1 truncate">{enonceName}</span>
                <button onClick={() => { setEnonceFile(null); setEnonceName(null); setEnonceUrl(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => enonceInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Importer un fichier LaTeX (.tex) ou PDF
              </button>
            )}
            <input
              ref={enonceInputRef}
              type="file"
              accept=".pdf,image/*,.tex,.txt"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'enonce')}
              className="hidden"
            />
          </div>

          {/* Énoncé — PDF pour les élèves */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileText className="w-4 h-4 text-sky-500" />
              PDF du sujet (visible et téléchargeable par les élèves)
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Déposez ici la version PDF compilée du sujet. Les élèves ne verront que ce fichier.
            </p>
            {enoncePdfName ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <FileText className="w-4 h-4 text-sky-500" />
                <span className="text-sm text-slate-600 flex-1 truncate">{enoncePdfName}</span>
                <button onClick={() => { setEnoncePdfFile(null); setEnoncePdfName(null); setEnoncePdfUrl(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => enoncePdfInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Importer le PDF du sujet
              </button>
            )}
            <input
              ref={enoncePdfInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'enonce_pdf')}
              className="hidden"
            />
          </div>

          {/* Corrigé */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <FileCheck className="w-4 h-4 text-emerald-500" />
              Corrigé détaillé
            </label>
            <textarea
              value={corrigeText}
              onChange={(e) => setCorrigeText(e.target.value)}
              rows={5}
              placeholder="Saisissez le corrigé en texte (ou importez un PDF ci-dessous)…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y mb-2"
            />
            {corrigeName ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <FileText className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-600 flex-1 truncate">{corrigeName}</span>
                <button onClick={() => { setCorrigeFile(null); setCorrigeName(null); setCorrigeUrl(null); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => corrigeInputRef.current?.click()}
                className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Importer un PDF ou fichier LaTeX (.tex)
              </button>
            )}
            <input
              ref={corrigeInputRef}
              type="file"
              accept=".pdf,image/*,.tex,.txt"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'corrige')}
              className="hidden"
            />
          </div>

          {/* Barème */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <Award className="w-4 h-4 text-amber-500" />
              Barème de notation
            </label>
            <textarea
              value={baremeText}
              onChange={(e) => setBaremeText(e.target.value)}
              rows={4}
              placeholder={"Ex:\nQuestion 1: 4 points\nQuestion 2: 4 points\nQuestion 3: 4 points\nQuestion 4: 4 points\nQuestion 5: 4 points\nTotal: 20 points"}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y"
            />
          </div>

          {/* Date limite */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <CalendarClock className="w-4 h-4 text-brand-500" />
              Date limite de dépôt (optionnel)
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">Passé cette date, les élèves ne pourront plus soumettre leur devoir.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
              <Save className="w-4 h-4" />
              {editing ? 'Enregistrer' : 'Créer le devoir'}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
