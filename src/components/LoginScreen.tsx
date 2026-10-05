import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Shield,
  Delete,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { verifyStudentPin, verifyTeacherPassword, fetchStudents } from '@/lib/api';
import type { AuthState, Student } from '@/types';

interface LoginScreenProps {
  onAuth: (auth: AuthState) => void;
}

export function LoginScreen({ onAuth }: LoginScreenProps) {
  const [mode, setMode] = useState<'choose' | 'student' | 'teacher'>('choose');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [pin, setPin] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (mode === 'student') {
      setLoadingStudents(true);
      fetchStudents()
        .then(setStudents)
        .catch(() => setError('Impossible de charger la liste des élèves.'))
        .finally(() => setLoadingStudents(false));
    }
  }, [mode]);

  const handlePinPress = useCallback((digit: string) => {
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
    setError('');
  }, []);

  const handlePinDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && selectedStudent && mode === 'student') {
      handleStudentLogin();
    }
  }, [pin]);

  const handleStudentLogin = async () => {
    if (!selectedStudent || pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const result = await verifyStudentPin(selectedStudent, pin);
      if (result.success && result.student_id) {
        onAuth({ role: 'student', studentId: result.student_id, studentName: result.name });
      } else {
        setError(result.error || 'Connexion échouée.');
        setPin('');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async () => {
    if (!teacherPassword) return;
    setLoading(true);
    setError('');
    try {
      const ok = await verifyTeacherPassword(teacherPassword);
      if (ok) {
        onAuth({ role: 'teacher' });
      } else {
        setError('Mot de passe incorrect.');
        setTeacherPassword('');
      }
    } catch {
      setError('Erreur de connexion. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setMode('choose');
    setSelectedStudent('');
    setPin('');
    setTeacherPassword('');
    setError('');
  };

  // ── Mode selection ──
  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-slide-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/20 mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Correct<span className="text-brand-600">DM</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pré-correction de devoirs de mathématiques — MPSI</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode('student')}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all text-left group"
            >
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <GraduationCap className="w-6 h-6 text-brand-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Je suis élève</p>
                <p className="text-sm text-slate-400">Déposer un devoir à corriger</p>
              </div>
            </button>

            <button
              onClick={() => setMode('teacher')}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all text-left group"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Shield className="w-6 h-6 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Je suis enseignant</p>
                <p className="text-sm text-slate-400">Gérer les devoirs et corrections</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Student login ──
  if (mode === 'student') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full animate-slide-up">
          <button
            onClick={resetState}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            {/* Student picker */}
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <GraduationCap className="w-4 h-4 text-brand-500" />
                Choisissez votre nom
              </label>
              {loadingStudents ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement…
                </div>
              ) : (
                <select
                  value={selectedStudent}
                  onChange={(e) => {
                    setSelectedStudent(e.target.value);
                    setPin('');
                    setError('');
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all bg-white"
                >
                  <option value="">— Sélectionner —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* PIN keypad */}
            {selectedStudent && (
              <div className="animate-slide-down">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                  <Lock className="w-4 h-4 text-brand-500" />
                  Code PIN (4 chiffres)
                </label>

                {/* PIN dots */}
                <div className="flex justify-center gap-3 mb-5">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full transition-all ${
                        pin.length > i
                          ? 'bg-brand-500 scale-110'
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 animate-slide-down">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Numeric keypad */}
                <div className="grid grid-cols-3 gap-2.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      onClick={() => handlePinPress(d)}
                      disabled={loading || pin.length >= 4}
                      className="aspect-[5/4] flex items-center justify-center text-2xl font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-100 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {d}
                    </button>
                  ))}
                  <div />
                  <button
                    onClick={() => handlePinPress('0')}
                    disabled={loading || pin.length >= 4}
                    className="aspect-[5/4] flex items-center justify-center text-2xl font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-100 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 active:scale-95 transition-all disabled:opacity-40"
                  >
                    0
                  </button>
                  <button
                    onClick={handlePinDelete}
                    disabled={pin.length === 0 || loading}
                    className="aspect-[5/4] flex items-center justify-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100 hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:scale-95 transition-all disabled:opacity-40"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm text-brand-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connexion…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Teacher login ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full animate-slide-up">
        <button
          onClick={resetState}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7 text-slate-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Espace enseignant</h2>
            <p className="text-sm text-slate-400 mt-1">Saisissez votre mot de passe</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTeacherLogin();
            }}
          >
            <input
              type="password"
              value={teacherPassword}
              onChange={(e) => {
                setTeacherPassword(e.target.value);
                setError('');
              }}
              placeholder="Mot de passe"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all mb-3"
            />

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-3 animate-slide-down">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Se connecter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
