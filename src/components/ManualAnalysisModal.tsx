import { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Upload,
  Save,
  AlertCircle,
  ClipboardPaste,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { fetchAssignmentById } from '@/lib/api';
import { updateSubmission } from '@/lib/api';
import type { Submission, Assignment } from '@/types';

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

const SYSTEM_PROMPT = `Tu es un professeur de mathématiques en classe préparatoire MPSI, bienveillant et rigoureux.
On te fournit :
1. L'énoncé du devoir (sujet).
2. Le corrigé détaillé du devoir.
3. Le barème de notation.
4. La copie de l'élève (texte saisi, image manuscrite, ou PDF).

Analyse la copie de l'élève en la comparant au corrigé et au barème. Évalue chaque question, attribue les points selon le barème, et renvoie un objet JSON contenant :
- "note": La note totale sur 20 (un nombre décimal, somme des points obtenus selon le barème).
- "points_forts": Liste des questions ou parties bien réussies (chaque élément est une phrase courte).
- "axes_amelioration": Liste des erreurs, oublis ou points à approfondir (chaque élément est une phrase courte).
- "commentaire_global": Un résumé constructif et encourageant pour l'élève (2-3 phrases).
- "detail_correction": Une correction détaillée question par question, indiquant pour chaque question ce que l'élève a fait, ce qui est juste, ce qui est faux, et les points attribués. Format en texte simple avec des retours à la ligne.

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire ni markdown.`;

interface ManualAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  submission: Submission | null;
  onSaved: () => void;
}

interface AnalysisResult {
  note: number;
  points_forts: string[];
  axes_amelioration: string[];
  commentaire_global: string;
  detail_correction: string;
}

function parseGeminiResponse(raw: string): AnalysisResult {
  let text = raw.trim();

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // Find the first { and last } to extract JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(text);

  const note = typeof parsed.note === 'number' ? parsed.note : parseFloat(parsed.note) || 0;
  const points_forts = Array.isArray(parsed.points_forts) ? parsed.points_forts.map(String) : [];
  const axes_amelioration = Array.isArray(parsed.axes_amelioration) ? parsed.axes_amelioration.map(String) : [];
  const commentaire_global = typeof parsed.commentaire_global === 'string' ? parsed.commentaire_global : '';
  const detail_correction = typeof parsed.detail_correction === 'string' ? parsed.detail_correction : '';

  return { note, points_forts, axes_amelioration, commentaire_global, detail_correction };
}

export function ManualAnalysisModal({ open, onClose, submission, onSaved }: ManualAnalysisModalProps) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open || !submission) return;
    setError(null);
    setSuccess(false);
    setPastedJson('');
    setCopied(false);

    if (submission.assignment_id) {
      setLoadingAssignment(true);
      fetchAssignmentById(submission.assignment_id)
        .then(setAssignment)
        .catch(() => setAssignment(null))
        .finally(() => setLoadingAssignment(false));
    } else {
      setAssignment(null);
    }
  }, [open, submission]);

  const promptText = useMemo(() => {
    if (!submission) return '';
    const parts: string[] = [SYSTEM_PROMPT, '', '---', ''];

    parts.push(`Titre du devoir: ${submission.exercise_title}`);
    parts.push('');

    if (assignment?.enonce_text) {
      parts.push(`ÉNONCÉ:`);
      parts.push(assignment.enonce_text);
      parts.push('');
    }
    if (assignment?.corrige_text) {
      parts.push(`CORRIGÉ:`);
      parts.push(assignment.corrige_text);
      parts.push('');
    }
    if (assignment?.bareme_text) {
      parts.push(`BARÈME:`);
      parts.push(assignment.bareme_text);
      parts.push('');
    }
    if (submission.text_answer && submission.text_answer.trim()) {
      parts.push(`COPIE DE L'ÉLÈVE (texte):`);
      parts.push(submission.text_answer);
      parts.push('');
    }

    if (submission.file_url) {
      const files = getAttachedFiles(submission);
      if (files.length > 1) {
        parts.push(`FICHIERS JOINTS PAR L'ÉLÈVE (${files.length} fichiers):`);
        files.forEach((f, i) => {
          parts.push(`  Fichier ${i + 1}: ${f.name}`);
          parts.push(`  Lien: ${f.url}`);
        });
        parts.push(`(Téléchargez TOUS les fichiers ci-dessus et joignez-les à votre prompt Gemini)`);
      } else {
        parts.push(`FICHIER JOINT PAR L'ÉLÈVE: ${submission.file_name || 'fichier'}`);
        parts.push(`(Téléchargez le fichier ci-dessous et joignez-le à votre prompt Gemini)`);
        parts.push(`Lien: ${submission.file_url}`);
      }
      parts.push('');
    }

    if (assignment?.enonce_url) {
      parts.push(`FICHIER ÉNONCÉ (à joindre si nécessaire): ${assignment.enonce_url}`);
      parts.push('');
    }
    if (assignment?.corrige_url) {
      parts.push(`FICHIER CORRIGÉ (à joindre si nécessaire): ${assignment.corrige_url}`);
      parts.push('');
    }

    parts.push('Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire ni markdown.');

    return parts.join('\n');
  }, [submission, assignment]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier. Sélectionnez le texte manuellement.');
    }
  };

  const handleSave = async () => {
    if (!submission) return;
    setError(null);
    setSaving(true);

    try {
      const result = parseGeminiResponse(pastedJson);

      if (result.note < 0 || result.note > 20) {
        throw new Error('La note doit être comprise entre 0 et 20.');
      }

      await updateSubmission(submission.id, {
        ai_note: result.note,
        ai_points_forts: result.points_forts,
        ai_axes_amelioration: result.axes_amelioration,
        ai_commentaire: result.commentaire_global,
        ai_detail: result.detail_correction,
        ai_status: 'analyzed',
      });

      setSuccess(true);
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1200);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Le JSON collé est invalide. Vérifiez que vous avez bien copié toute la réponse de Gemini (avec les accolades { }).');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Une erreur est survenue lors de l\'enregistrement.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!submission) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Analyse manuelle — ${submission.student_name}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Context */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-xs text-slate-400 uppercase font-semibold mb-0.5">Devoir</p>
          <p className="text-sm font-medium text-slate-700">{submission.exercise_title}</p>
        </div>

        {loadingAssignment && (
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            Chargement du contexte du devoir…
          </div>
        )}

        {/* File link */}
        {submission.file_url && (() => {
          const files = getAttachedFiles(submission);
          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {submission.file_type?.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {files.length > 1 ? `Copie de l'élève (${files.length} fichiers)` : 'Copie de l\'élève'}
              </div>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-brand-600 hover:text-brand-700 hover:border-brand-300 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {files.length > 1 ? `Fichier ${i + 1}` : 'Voir / télécharger'}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Step 1: Copy prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">1</span>
              Prompt à copier dans Gemini
            </label>
            <Button
              variant={copied ? 'success' : 'secondary'}
              size="sm"
              onClick={handleCopyPrompt}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié !' : 'Copier le prompt'}
            </Button>
          </div>
          <textarea
            readOnly
            value={promptText}
            rows={10}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono bg-slate-50 focus:outline-none resize-y"
          />
          <p className="text-xs text-slate-400">
            Collez ce prompt dans Gemini (ou tout autre outil d'IA), joignez le fichier de l'élève si nécessaire,
            puis collez la réponse JSON ci-dessous.
          </p>
        </div>

        {/* Step 2: Paste response */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">2</span>
            Coller la réponse JSON de Gemini
          </label>
          <textarea
            value={pastedJson}
            onChange={(e) => {
              setPastedJson(e.target.value);
              setError(null);
            }}
            rows={10}
            placeholder='Collez ici la réponse de Gemini, par exemple :&#10;{&#10;  "note": 14.5,&#10;  "points_forts": [...],&#10;  "axes_amelioration": [...],&#10;  "commentaire_global": "...",&#10;  "detail_correction": "...&#10;}'
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all resize-y"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 animate-slide-down">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2 animate-slide-down">
            <Check className="w-4 h-4" />
            Correction enregistrée avec succès !
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!pastedJson.trim() || success}
            fullWidth
          >
            <Save className="w-4 h-4" /> Enregistrer la correction
          </Button>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
