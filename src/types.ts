export type AiStatus = 'pending' | 'analyzed' | 'failed';
export type ValidationStatus = 'a_relire' | 'valide' | 'modifie';
export type AssignmentStatus = 'open' | 'closed';

export interface Student {
  id: string;
  name: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  enonce_text: string | null;
  corrige_text: string | null;
  bareme_text: string | null;
  enonce_url: string | null;
  enonce_name: string | null;
  enonce_pdf_url: string | null;
  enonce_pdf_name: string | null;
  corrige_url: string | null;
  corrige_name: string | null;
  status: AssignmentStatus;
  due_date: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  student_id: string | null;
  assignment_id: string | null;
  student_name: string;
  subject: string;
  exercise_title: string;
  text_answer: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  ai_note: number | null;
  ai_points_forts: string[];
  ai_axes_amelioration: string[];
  ai_commentaire: string | null;
  ai_detail: string | null;
  ai_status: AiStatus;
  validation_status: ValidationStatus;
  final_note: number | null;
  final_comment: string | null;
  created_at: string;
}

export interface AuthState {
  role: 'student' | 'teacher' | null;
  studentId?: string;
  studentName?: string;
}
