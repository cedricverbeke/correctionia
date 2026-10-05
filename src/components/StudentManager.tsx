import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Users,
  Trash2,
  KeyRound,
  Upload,
  Download,
  Loader2,
  AlertCircle,
  X,
  Save,
  UserPlus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  fetchStudents,
  addStudent,
  updateStudentPin,
  deleteStudent,
} from '@/lib/api';
import type { Student } from '@/types';

export function StudentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [adding, setAdding] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchStudents()
      .then(setStudents)
      .catch(() => setError('Impossible de charger la liste des élèves.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newName.trim() || !newPin.trim()) {
      setError('Le nom et le code PIN sont obligatoires.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await addStudent(newName.trim(), newPin.trim());
      setAddModalOpen(false);
      setNewName('');
      setNewPin('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'élève "${name}" ?`)) return;
    try {
      await deleteStudent(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    }
  };

  const handleSavePin = async (id: string) => {
    if (!pinValue.trim()) return;
    setSavingPin(true);
    try {
      await updateStudentPin(id, pinValue.trim());
      setEditingPin(null);
      setPinValue('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvText.trim()) {
      setCsvError('Veuillez coller les données CSV.');
      return;
    }
    setCsvImporting(true);
    setCsvError('');
    setCsvSuccess('');

    const lines = csvText.trim().split('\n');
    const results: { name: string; success: boolean }[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Format: NOM Prénom,mot de passe
      const lastComma = trimmed.lastIndexOf(',');
      if (lastComma === -1) {
        results.push({ name: trimmed, success: false });
        continue;
      }
      const name = trimmed.substring(0, lastComma).trim();
      const pin = trimmed.substring(lastComma + 1).trim();
      if (!name || !pin) {
        results.push({ name: name || trimmed, success: false });
        continue;
      }
      try {
        await addStudent(name, pin);
        results.push({ name, success: true });
      } catch {
        results.push({ name, success: false });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (failCount === 0) {
      setCsvSuccess(`${successCount} élève(s) importé(s) avec succès.`);
      setCsvText('');
    } else {
      setCsvError(`${successCount} importé(s), ${failCount} échec(s).`);
    }

    load();
    setCsvImporting(false);
  };

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvText(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    const csv = students.map((s) => s.name).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eleves.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gérer les élèves</h2>
          <p className="text-sm text-slate-400">
            {students.length} élève(s) — ajoutez, modifiez les codes ou importez un fichier CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => setCsvModalOpen(true)}>
            <Upload className="w-4 h-4" />
            Importer CSV
          </Button>
          <Button variant="primary" size="md" onClick={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-slide-down">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un élève…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun élève</p>
          <p className="text-slate-400 text-sm mt-1">
            Ajoutez des élèves individuellement ou importez un fichier CSV.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3 w-48">Code PIN</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-3">
                      {editingPin === s.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pinValue}
                            onChange={(e) => setPinValue(e.target.value)}
                            placeholder="Nouveau code"
                            className="w-28 px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePin(s.id)}
                            disabled={savingPin}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingPin(null); setPinValue(''); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">••••</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditingPin(s.id); setPinValue(''); }}
                        className="p-2 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
                        title="Modifier le code"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export button */}
      {students.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleExportCsv}>
            <Download className="w-4 h-4" />
            Exporter la liste
          </Button>
        </div>
      )}

      {/* Add student modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Ajouter un élève"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Nom et prénom
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: DUPONT Jean"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Code PIN (4 chiffres)
            </label>
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Ex: 1234"
              maxLength={4}
              className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all text-center text-lg font-mono"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleAdd} loading={adding} fullWidth>
              <UserPlus className="w-4 h-4" />
              Ajouter
            </Button>
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      </Modal>

      {/* CSV import modal */}
      <Modal
        open={csvModalOpen}
        onClose={() => { setCsvModalOpen(false); setCsvError(''); setCsvSuccess(''); }}
        title="Importer des élèves (CSV)"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-brand-50/50 border border-brand-100 text-sm text-brand-700">
            Format : <code className="font-mono bg-white px-1.5 py-0.5 rounded">NOM Prénom,code</code>
            <br />
            Une ligne par élève. Exemple :
            <pre className="mt-2 text-xs font-mono bg-white rounded-lg p-2 border border-slate-200">
{`DUPONT Jean,1234
MARTIN Marie,5678`}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">
                Données CSV
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Upload className="w-4 h-4" />
                Charger un fichier
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={(e) => handleCsvFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={12}
              placeholder="Collez ici les données CSV…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y"
            />
          </div>

          {csvError && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {csvError}
            </div>
          )}
          {csvSuccess && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Save className="w-4 h-4 shrink-0" />
              {csvSuccess}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleCsvImport} loading={csvImporting} fullWidth>
              <Upload className="w-4 h-4" />
              Importer
            </Button>
            <Button variant="secondary" onClick={() => { setCsvModalOpen(false); setCsvError(''); setCsvSuccess(''); }}>
              Fermer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
