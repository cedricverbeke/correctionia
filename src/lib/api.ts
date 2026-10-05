import { supabase } from '@/lib/supabase';
import type { Submission, Assignment, Student } from '@/types';

// ── Auth ──

export async function verifyStudentPin(name: string, pin: string): Promise<{ success: boolean; student_id?: string; name?: string; error?: string }> {
  const { data, error } = await supabase.rpc('verify_student_pin', {
    p_name: name,
    p_pin: pin,
  });
  if (error) return { success: false, error: error.message };
  return data as { success: boolean; student_id?: string; name?: string; error?: string };
}

export async function verifyTeacherPassword(password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_teacher_password', {
    p_password: password,
  });
  if (error) return false;
  return data as boolean;
}

// ── Students ──

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('student_list').select('id, name').order('name');
  if (error) throw error;
  return (data || []) as Student[];
}

export async function addStudent(name: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('add_student', { p_name: name, p_pin: pin });
  if (error) throw error;
}

export async function updateStudentPin(id: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('update_student_pin', { p_id: id, p_pin: pin });
  if (error) throw error;
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_student', { p_id: id });
  if (error) throw error;
}

// ── Assignments ──

export async function fetchAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Assignment[];
}

export async function createAssignment(a: Omit<Assignment, 'id' | 'created_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('assignments')
    .insert(a)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateAssignment(id: string, updates: Partial<Assignment>): Promise<void> {
  const { error } = await supabase.from('assignments').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { data: subs } = await supabase
    .from('submissions')
    .select('file_url, file_name')
    .eq('assignment_id', id);

  if (subs) {
    for (const sub of subs) {
      await deleteSubmissionFiles(sub.file_url, sub.file_name);
    }
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('enonce_url, enonce_pdf_url, corrige_url')
    .eq('id', id)
    .maybeSingle();

  if (assignment) {
    if (assignment.enonce_url) await removeStorageFile('assignment-files', assignment.enonce_url);
    if (assignment.enonce_pdf_url) await removeStorageFile('assignment-files', assignment.enonce_pdf_url);
    if (assignment.corrige_url) await removeStorageFile('assignment-files', assignment.corrige_url);
  }

  await supabase
    .from('submissions')
    .update({ file_url: null, file_name: null, file_type: null })
    .eq('assignment_id', id);

  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

// ── Submissions ──

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Submission[];
}

export async function updateSubmission(id: string, updates: Partial<Submission>): Promise<void> {
  const { error } = await supabase.from('submissions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function fetchStudentSubmissions(studentId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Submission[];
}

export async function deleteSubmission(id: string): Promise<void> {
  const { data: sub } = await supabase
    .from('submissions')
    .select('file_url, file_name')
    .eq('id', id)
    .maybeSingle();

  if (sub) {
    await deleteSubmissionFiles(sub.file_url, sub.file_name);
  }

  const { error } = await supabase.from('submissions').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllSubmissions(): Promise<void> {
  const { data: subs } = await supabase
    .from('submissions')
    .select('file_url, file_name');

  if (subs) {
    for (const sub of subs) {
      await deleteSubmissionFiles(sub.file_url, sub.file_name);
    }
  }

  const { error } = await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

export async function fetchAssignmentById(id: string): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Assignment | null;
}

// ── AI Analysis ──

export async function triggerAnalysis(
  submissionId: string,
  assignmentId: string | null,
  exerciseTitle: string,
  textAnswer: string | null,
  fileUrl: string | null,
  fileType: string | null,
  fileName: string | null
): Promise<void> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-homework`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      submissionId,
      assignmentId,
      exerciseTitle,
      textAnswer,
      fileUrl,
      fileType,
      fileName,
    }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Analyse échouée (${response.status})`);
  }
}

// ── App Settings ──

export async function fetchGeminiModel(): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('gemini_model')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data?.gemini_model ?? 'gemini-3.5-flash-lite';
}

export async function updateGeminiModel(model: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, gemini_model: model })
    .eq('id', 1);
  if (error) throw error;
}

// ── Storage helpers ──

async function removeStorageFile(bucket: string, publicUrl: string): Promise<void> {
  try {
    const url = new URL(publicUrl);
    const prefix = '/storage/v1/object/public/' + bucket + '/';
    const idx = url.pathname.indexOf(prefix);
    if (idx !== -1) {
      const filePath = decodeURIComponent(url.pathname.slice(idx + prefix.length));
      await supabase.storage.from(bucket).remove([filePath]);
    }
  } catch {
    // URL parsing failed — skip file deletion
  }
}

async function deleteSubmissionFiles(fileUrl: string | null, fileName: string | null): Promise<void> {
  if (!fileUrl) return;

  if (fileName) {
    try {
      const parsed = JSON.parse(fileName);
      if (Array.isArray(parsed)) {
        for (const f of parsed) {
          if (f.url) await removeStorageFile('homework-files', f.url);
        }
        return;
      }
    } catch {
      // Not JSON — single file, continue below
    }
  }

  await removeStorageFile('homework-files', fileUrl);
}

// ── File uploads ──

export async function uploadHomeworkFile(file: File): Promise<{ url: string; name: string; type: string }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('homework-files').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('homework-files').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name, type: file.type };
}

export async function uploadAssignmentFile(file: File): Promise<{ url: string; name: string }> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('assignment-files').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('assignment-files').getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}
