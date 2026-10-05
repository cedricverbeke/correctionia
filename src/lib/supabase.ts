import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/analyze-homework`;

export async function triggerAnalysis(
  submissionId: string,
  assignmentId: string | null,
  exerciseTitle: string,
  textAnswer: string | null,
  fileUrl: string | null,
  fileType: string | null,
  fileName: string | null
): Promise<void> {
  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
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
      console.error('Edge function error:', errData.error || response.statusText);
    }
  } catch (err) {
    console.error('triggerAnalysis failed:', err);
  }
}
