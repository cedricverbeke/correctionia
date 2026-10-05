import { useState } from 'react';
import { GraduationCap, LayoutDashboard, ClipboardList, LogOut, Shield, Sparkles, Users } from 'lucide-react';
import { LoginScreen } from '@/components/LoginScreen';
import { StudentView } from '@/components/StudentView';
import { TeacherDashboard } from '@/components/TeacherView';
import { AssignmentManager } from '@/components/AssignmentManager';
import { StudentManager } from '@/components/StudentManager';
import type { AuthState } from '@/types';

type TeacherTab = 'dashboard' | 'assignments' | 'students';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ role: null });
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('dashboard');

  if (!auth.role) {
    return <LoginScreen onAuth={setAuth} />;
  }

  const handleLogout = () => {
    setAuth({ role: null });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-sm shadow-brand-600/20">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-none">
                  Correct<span className="text-brand-600">DM</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                  Mathématiques MPSI
                </p>
              </div>
            </div>

            {/* User info + logout */}
            <div className="flex items-center gap-3">
              {auth.role === 'student' && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 bg-brand-50 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-brand-600" />
                  </div>
                  <span className="font-medium text-slate-700 hidden sm:inline">{auth.studentName}</span>
                </div>
              )}
              {auth.role === 'teacher' && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-slate-600" />
                  </div>
                  <span className="font-medium text-slate-700 hidden sm:inline">Enseignant</span>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Teacher tabs */}
          {auth.role === 'teacher' && (
            <nav className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl mb-3 w-fit">
              <button
                onClick={() => setTeacherTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  teacherTab === 'dashboard' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Tableau de bord
              </button>
              <button
                onClick={() => setTeacherTab('assignments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  teacherTab === 'assignments' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Gérer les devoirs
              </button>
              <button
                onClick={() => setTeacherTab('students')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  teacherTab === 'students' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="w-4 h-4" />
                Élèves
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Student banner */}
      {auth.role === 'student' && (
        <div className="bg-gradient-to-r from-brand-50 to-slate-50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-brand-700">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Votre devoir sera corrigé à partir du sujet et du corrigé de référence.</span>
          </div>
        </div>
      )}

      {/* Content */}
      <main>
        {auth.role === 'student' && <StudentView auth={auth} />}
        {auth.role === 'teacher' && teacherTab === 'dashboard' && <TeacherDashboard />}
        {auth.role === 'teacher' && teacherTab === 'assignments' && <AssignmentManager />}
        {auth.role === 'teacher' && teacherTab === 'students' && <StudentManager />}
      </main>

      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs text-slate-400">
          CorrectDM — Correction de devoirs de mathématiques
        </div>
      </footer>
    </div>
  );
}
