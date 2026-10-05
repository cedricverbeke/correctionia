import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  BookOpen,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Download,
  Star,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  ClipboardList,
  Eye,
  Clock,
  Sparkles,
  Camera,
  Plus,
  CalendarClock,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LatexRenderer } from '@/components/ui/LatexRenderer';
import { supabase, triggerAnalysis } from '@/lib/supabase';
import { fetchAssignments, uploadHomeworkFile, fetchStudentSubmissions } from '@/lib/api';
import type { Assignment, Submission, AuthState } from '@/types';

const ACCEPTED_TYPES = '.pdf,image/*,.txt,.tex';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type View = 'list' | 'submit' | 'success' | 'corrections' | 'correction_detail';

interface StudentViewProps {
  auth: AuthState;
}

function isLatexContent(text: string): boolean {
  return /\\(begin|end|frac|sqrt|sum|int|prod|alpha|beta|gamma|delta|epsilon|lambda|mu|pi|sigma|theta|infty|partial|nabla|cdot|times|div|leq|geq|neq|approx|equiv|subset|supset|in|notin|cup|cap|forall|exists|mathbb|mathcal|mathrm|mathbf|left|right|vec|hat|bar|dot|overline|underline|section|subsection|textbf|textit|emph|item|enumerate|equation|align|matrix|pmatrix|bmatrix|vmatrix|cases|array)/.test(text)
    || /\$[^$]+\$/.test(text);
}

export function StudentView({ auth }: StudentViewProps) {
  const [view, setView] = useState<View>('list');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isPastDeadline = (a: Assignment): boolean => {
    if (!a.due_date) return false;
    return new Date(a.due_date) < new Date();
  };

  useEffect(() => {
    fetchAssignments()
      .then((data) => setAssignments(data.filter((a) => a.status === 'open')))
      .catch(() => setErrorMsg('Impossible de charger les devoirs.'))
      .finally(() => setLoadingAssignments(false));
  }, []);

  const loadSubmissions = useCallback(() => {
    if (!auth.studentId) return;
    setLoadingSubmissions(true);
    fetchStudentSubmissions(auth.studentId)
      .then(setSubmissions)
      .catch(() => {})
      .finally(() => setLoadingSubmissions(false));
  }, [auth.studentId]);

  // Update selectedSubmission when submissions change (polling)
  useEffect(() => {
    if (selectedSubmission && submissions.length > 0) {
      const updated = submissions.find((s) => s.id === selectedSubmission.id);
      if (updated && updated.ai_status !== selectedSubmission.ai_status) {
        setSelectedSubmission(updated);
      }
    }
  }, [submissions]);

  // Poll submissions every 10s so the student sees the AI result without manual refresh.
  useEffect(() => {
    if (view !== 'success' && view !== 'corrections' && view !== 'correction_detail') return;
    if (!auth.studentId) return;
    const studentId = auth.studentId;
    const interval = setInterval(() => {
      fetchStudentSubmissions(studentId)
        .then(setSubmissions)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [view, auth.studentId]);

  const addFiles = useCallback((newFiles: File[] | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const valid = newFiles.filter((f) => f.size <= MAX_FILE_SIZE);
    if (valid.length < newFiles.length) {
      setErrorMsg('Un ou plusieurs fichiers dépassent 10 Mo.');
    } else {
      setErrorMsg('');
    }
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    if (!selectedFile) return;
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMsg('Le fichier dépasse 10 Mo.');
      return;
    }
    setFiles((prev) => [...prev, selectedFile]);
    setErrorMsg('');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) addFiles(droppedFiles);
  }, [addFiles]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTextAnswer('');
    setFiles([]);
    setStatus('idle');
    setErrorMsg('');
    setSelectedAssignment(null);
    setView('list');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) {
      setErrorMsg('Veuillez choisir un devoir.');
      return;
    }
    if (files.length === 0 && !textAnswer.trim()) {
      setErrorMsg('Veuillez joindre un fichier ou saisir votre réponse.');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;

      if (files.length === 1) {
        const uploaded = await uploadHomeworkFile(files[0]);
        fileUrl = uploaded.url;
        fileName = uploaded.name;
        fileType = uploaded.type;
      } else if (files.length > 1) {
        // Upload all files, store the list of URLs in the first file's metadata
        const uploadedFiles = await Promise.all(files.map((f) => uploadHomeworkFile(f)));
        fileUrl = uploadedFiles[0].url;
        fileName = uploadedFiles.map((f) => f.name).join(', ');
        fileType = uploadedFiles[0].type;
        // Store all URLs in text_answer as a JSON appendix if there's also text
        const urlsList = uploadedFiles.map((f) => f.url);
        if (textAnswer.trim()) {
          // Keep text answer, we'll store file URLs separately
          // For now we use the first URL as primary and note multiple files
        }
        // Store additional file URLs in file_name field as metadata
        fileName = JSON.stringify(uploadedFiles.map((f) => ({ name: f.name, url: f.url, type: f.type })));
      }

      const { data, error: insertError } = await supabase
        .from('submissions')
        .insert({
          student_id: auth.studentId,
          student_name: auth.studentName,
          assignment_id: selectedAssignment.id,
          subject: 'Mathématiques — MPSI',
          exercise_title: selectedAssignment.title,
          text_answer: textAnswer.trim() || null,
          file_url: fileUrl,
          file_name: fileName,
          file_type: fileType,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      triggerAnalysis(
        data.id,
        selectedAssignment.id,
        selectedAssignment.title,
        textAnswer.trim() || null,
        fileUrl,
        fileType,
        fileName
      ).catch(() => {});

      setView('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  };

  // ── Success screen ──
  if (view === 'success') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Votre devoir a bien été transmis
          </h2>
          <p className="text-slate-500 mb-6">
            Il est en cours d'analyse par l'IA. Votre enseignant recevra la pré-correction
            automatiquement.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-brand-600 mb-6">
            <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse-soft" />
            <span>Analyse IA en cours…</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="secondary" onClick={resetForm}>
              Déposer un autre devoir
            </Button>
            <Button variant="primary" onClick={() => { loadSubmissions(); setView('corrections'); }}>
              <Eye className="w-4 h-4" />
              Voir mes corrections
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Correction detail ──
  if (view === 'correction_detail' && selectedSubmission) {
    const sub = selectedSubmission;
    const note = sub.final_note ?? sub.ai_note;
    const comment = sub.final_comment ?? sub.ai_commentaire;
    const showAi = sub.ai_status === 'analyzed';

    // Parse multiple files if stored as JSON
    let attachedFiles: { name: string; url: string }[] = [];
    if (sub.file_url) {
      try {
        const parsed = JSON.parse(sub.file_name || '');
        if (Array.isArray(parsed)) {
          attachedFiles = parsed.map((f: { name: string; url: string }) => ({ name: f.name, url: f.url }));
        }
      } catch {
        attachedFiles = [{ name: sub.file_name || 'Fichier', url: sub.file_url }];
      }
    }

    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
        <button
          onClick={() => { setView('corrections'); setSelectedSubmission(null); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour à mes corrections
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-xl font-bold text-slate-900 mb-1">{sub.exercise_title}</h1>
            <p className="text-sm text-slate-400">
              Soumis le {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Status banner */}
          {sub.ai_status === 'pending' && (
            <div className="p-6 bg-amber-50/50 border-b border-amber-100">
              <div className="flex items-center gap-2 text-amber-700">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Analyse en cours…</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">
                Votre copie est en cours de correction par l'IA. Revenez plus tard pour voir le résultat.
              </p>
            </div>
          )}

          {sub.ai_status === 'failed' && (
            <div className="p-6 bg-red-50/50 border-b border-red-100">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">L'analyse n'a pas pu aboutir</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Votre enseignant corrigera votre copie manuellement.
              </p>
            </div>
          )}

          {showAi && (
            <div className="p-6 space-y-6">
              {/* Note */}
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50/30 border border-brand-100">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                  <Star className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Note</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {note !== null ? note : '—'}<span className="text-lg text-slate-400">/20</span>
                  </p>
                </div>
                {sub.validation_status === 'valide' && (
                  <span className="ml-auto px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                    Validé par l'enseignant
                  </span>
                )}
                {sub.validation_status === 'modifie' && (
                  <span className="ml-auto px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                    Note ajustée
                  </span>
                )}
              </div>

              {/* Commentaire global */}
              {comment && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <MessageSquare className="w-4 h-4 text-brand-500" />
                    Commentaire général
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed p-4 rounded-xl bg-slate-50 border border-slate-100">
                    {comment}
                  </p>
                </div>
              )}

              {/* Points forts / Axes d'amélioration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Points forts
                  </div>
                  <ul className="space-y-2">
                    {(sub.ai_points_forts || []).map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                    {(!sub.ai_points_forts || sub.ai_points_forts.length === 0) && (
                      <li className="text-sm text-slate-400 italic">Aucun point fort renseigné.</li>
                    )}
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 mb-3">
                    <Lightbulb className="w-4 h-4" />
                    Axes d'amélioration
                  </div>
                  <ul className="space-y-2">
                    {(sub.ai_axes_amelioration || []).map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                    {(!sub.ai_axes_amelioration || sub.ai_axes_amelioration.length === 0) && (
                      <li className="text-sm text-slate-400 italic">Aucun axe d'amélioration renseigné.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Correction détaillée */}
              {sub.ai_detail && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <ClipboardList className="w-4 h-4 text-brand-500" />
                    Correction détaillée
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto scrollbar-thin">
                      {sub.ai_detail}
                    </pre>
                  </div>
                </div>
              )}

              {/* File links */}
              {attachedFiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 text-brand-500" />
                    {attachedFiles.length > 1 ? `Ma copie (${attachedFiles.length} fichiers)` : 'Ma copie'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-brand-600 hover:text-brand-700 hover:border-brand-300 transition-all">
                        <Download className="w-4 h-4" />
                        {attachedFiles.length > 1 ? `Fichier ${i + 1}` : f.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Corrections list ──
  if (view === 'corrections') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour aux devoirs
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Mes corrections</h1>
          <p className="text-slate-500">
            Consultez les notes et corrections de vos devoirs soumis.
          </p>
        </div>

        {loadingSubmissions ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Chargement…
          </div>
        ) : (() => {
          const validated = submissions.filter((s) => s.validation_status === 'valide' || s.validation_status === 'modifie');
          if (validated.length === 0) {
            return (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucune correction disponible</p>
                <p className="text-slate-400 text-sm mt-1">
                  Vos corrections apparaîtront ici une fois validées par votre enseignant.
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              {validated.map((sub) => {
                const note = sub.final_note ?? sub.ai_note;
                return (
                  <button
                    key={sub.id}
                    onClick={() => { setSelectedSubmission(sub); setView('correction_detail'); }}
                    className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-brand-50 group-hover:bg-brand-100 transition-colors">
                      <FileCheck className="w-6 h-6 text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{sub.exercise_title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                      {sub.validation_status === 'modifie' && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1">
                          <AlertCircle className="w-3 h-3" /> Note ajustée
                        </span>
                      )}
                    </div>
                    {note !== null && (
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-bold text-slate-900">{note}</span>
                        <span className="text-sm text-slate-400">/20</span>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0" />
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  }

  // ── Assignment selected: show submission form ──
  if (view === 'submit' && selectedAssignment) {
    const hasLatexSubject = selectedAssignment.enonce_text && isLatexContent(selectedAssignment.enonce_text);

    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
        <button
          onClick={() => { setView('list'); setSelectedAssignment(null); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Changer de devoir
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{selectedAssignment.title}</h1>
          {selectedAssignment.description && (
            <p className="text-slate-500">{selectedAssignment.description}</p>
          )}
          {selectedAssignment.due_date && (
            <p className={`text-sm mt-2 flex items-center gap-1.5 ${isPastDeadline(selectedAssignment) ? 'text-red-500' : 'text-amber-600'}`}>
              <CalendarClock className="w-4 h-4" />
              {isPastDeadline(selectedAssignment) ? 'Date limite dépassée' : 'À rendre avant'} : {new Date(selectedAssignment.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {isPastDeadline(selectedAssignment) && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <Lock className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Dépôt fermé</p>
              <p className="text-xs text-red-600">La date limite pour ce devoir est passée. Vous ne pouvez plus soumettre.</p>
            </div>
          </div>
        )}

        {/* Assignment subject */}
        {(selectedAssignment.enonce_pdf_url || selectedAssignment.enonce_url || selectedAssignment.enonce_text) && (
          <div className="bg-brand-50/50 border border-brand-100 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <FileCheck className="w-4 h-4" />
                Sujet du devoir
              </div>
              {hasLatexSubject && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-600 font-medium">
                  LaTeX
                </span>
              )}
            </div>
            {selectedAssignment.enonce_text && (
              <div className="mb-3 max-h-60 overflow-y-auto scrollbar-thin rounded-lg bg-white/60 p-3">
                {hasLatexSubject ? (
                  <LatexRenderer
                    content={selectedAssignment.enonce_text}
                    className="text-sm text-slate-700 leading-relaxed"
                  />
                ) : (
                  <div className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedAssignment.enonce_text}
                  </div>
                )}
              </div>
            )}
            {selectedAssignment.enonce_pdf_url && (
              <a
                href={selectedAssignment.enonce_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Download className="w-4 h-4" />
                Télécharger le sujet en PDF
              </a>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6"
        >
          {/* File upload */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Fichier(s) joint(s) — PDF, images, texte, LaTeX
            </label>

            {/* Already selected files */}
            {files.length > 0 && (
              <div className="space-y-2 mb-3">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 animate-scale-in">
                    {f.type.startsWith('image/') ? (
                      <ImageIcon className="w-7 h-7 text-brand-500 shrink-0" />
                    ) : (
                      <FileText className="w-7 h-7 text-brand-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {f.name}
                        {files.length > 1 && (
                          <span className="ml-2 text-xs text-slate-400">({i + 1}/{files.length})</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{(f.size / 1024).toFixed(1)} Ko</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                isDragging
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 font-medium mb-1">
                Glissez des fichiers ici ou choisissez une option
              </p>
              <p className="text-xs text-slate-400 mb-4">PDF, images, TXT, .tex — 10 Mo max par fichier</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-brand-300 hover:text-brand-600 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Choisir un fichier
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-sm font-medium text-white hover:bg-brand-700 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  Prendre une photo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                className="hidden"
              />
            </div>

            {/* Hint for multiple photos */}
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <Plus className="w-3 h-3" />
              Vous pouvez ajouter plusieurs photos (une par une avec la caméra, ou plusieurs à la fois depuis la galerie).
            </p>
          </div>

          {/* Text answer */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Réponse texte (si pas de fichier)
            </label>
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              rows={6}
              placeholder="Saisissez votre réponse directement ici…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-slide-down">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" variant="primary" size="lg" fullWidth loading={status === 'submitting'} disabled={isPastDeadline(selectedAssignment)}>
              <Send className="w-4 h-4" />
              Soumettre mon devoir
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── Assignment list (default) ──
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Déposer un devoir</h1>
        <p className="text-slate-500">
          Bonjour {auth.studentName}, choisissez un devoir à soumettre.
        </p>
      </div>

      {/* Quick access to corrections */}
      <button
        onClick={() => { loadSubmissions(); setView('corrections'); }}
        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-brand-50 to-amber-50/30 rounded-2xl border border-brand-100 hover:border-brand-200 hover:shadow-sm transition-all text-left mb-6 group"
      >
        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Mes corrections</p>
          <p className="text-sm text-slate-500">Consulter mes notes et corrections détaillées</p>
        </div>
        <ChevronRight className="w-5 h-5 text-brand-400 group-hover:text-brand-600 transition-colors shrink-0" />
      </button>

      {loadingAssignments ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement des devoirs…
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Aucun devoir disponible</p>
          <p className="text-slate-400 text-sm mt-1">
            Votre enseignant n'a pas encore publié de devoir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <button
              key={a.id}
              onClick={() => { setSelectedAssignment(a); setView('submit'); setErrorMsg(''); setTextAnswer(''); setFiles([]); }}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all text-left group"
            >
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
                <FileText className="w-6 h-6 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{a.title}</p>
                {a.description && (
                  <p className="text-sm text-slate-400 truncate">{a.description}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-300">
                    {new Date(a.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                  {a.due_date && (
                    <span className={`text-xs flex items-center gap-0.5 ${isPastDeadline(a) ? 'text-red-400' : 'text-amber-500'}`}>
                      <CalendarClock className="w-3 h-3" />
                      {isPastDeadline(a) ? 'Expiré' : new Date(a.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
