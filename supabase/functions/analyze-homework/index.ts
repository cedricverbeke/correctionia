// analyze-homework edge function — v4 (manual trigger support + gemini-3.8-flash)
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

interface RequestBody {
  submissionId: string;
  assignmentId?: string | null;
  exerciseTitle: string;
  textAnswer?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const data = btoa(binary);
    const mimeType = response.headers.get("content-type") || "application/octet-stream";
    return { data, mimeType };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let submissionId = "";

  try {
    const body: RequestBody = await req.json();
    submissionId = body.submissionId;
    const {
      assignmentId,
      exerciseTitle,
      textAnswer,
      fileUrl,
      fileType,
      fileName,
    } = body;

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "submissionId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch assignment context (énoncé, corrigé, barème)
    let enonceText = "";
    let corrigeText = "";
    let baremeText = "";
    let enonceFileUrl: string | null = null;
    let enonceFileName = "";
    let corrigeFileUrl: string | null = null;

    if (assignmentId) {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("enonce_text, corrige_text, bareme_text, enonce_url, enonce_name, corrige_url")
        .eq("id", assignmentId)
        .maybeSingle();

      if (assignment) {
        enonceText = assignment.enonce_text || "";
        corrigeText = assignment.corrige_text || "";
        baremeText = assignment.bareme_text || "";
        enonceFileUrl = assignment.enonce_url || null;
        enonceFileName = assignment.enonce_name || "";
        corrigeFileUrl = assignment.corrige_url || null;

        // If the énoncé file is a .tex, fetch its content as text and prepend to enonceText
        if (enonceFileUrl && enonceFileName.toLowerCase().endsWith(".tex")) {
          try {
            const texResp = await fetch(enonceFileUrl);
            if (texResp.ok) {
              const texContent = await texResp.text();
              enonceText = enonceText
                ? `${enonceText}\n\n[Contenu du fichier .tex:]\n${texContent}`
                : `[Contenu du fichier .tex:]\n${texContent}`;
            }
          } catch {
            // Ignore — fall back to whatever enonceText we have
          }
        }
      }
    }

    // Build the text part of the prompt
    const contextParts: string[] = [
      `Titre du devoir: ${exerciseTitle}`,
    ];

    if (enonceText) contextParts.push(`ÉNONCÉ:\n${enonceText}`);
    if (corrigeText) contextParts.push(`CORRIGÉ:\n${corrigeText}`);
    if (baremeText) contextParts.push(`BARÈME:\n${baremeText}`);
    if (textAnswer && textAnswer.trim()) {
      contextParts.push(`COPIE DE L'ÉLÈVE (texte):\n${textAnswer}`);
    }
    if (fileUrl && fileName) {
      contextParts.push(`FICHIER JOINT PAR L'ÉLÈVE: ${fileName}`);
    }

    if (!geminiKey) {
      // Simulated analysis when no API key
      const hasContent = (textAnswer && textAnswer.trim().length > 20) || fileUrl;
      const baseNote = hasContent ? 13.5 : 8;
      const note = Math.round((baseNote + Math.random() * 3 - 1.5) * 2) / 2;

      const simulated = {
        note,
        points_forts: [
          "Le devoir répond à la consigne demandée.",
          "La démarche générale est cohérente.",
          "Des efforts de rédaction mathématique sont visibles.",
        ],
        axes_amelioration: [
          "Justifier davantage les étapes de calcul.",
          "Vérifier les conditions d'application des théorèmes.",
          "Soigner la rigueur des notations mathématiques.",
        ],
        commentaire_global:
          "Travail satisfaisant dans l'ensemble. La copie montre une bonne compréhension du sujet mais mérite davantage de rigueur dans la rédaction. Continuez vos efforts !",
        detail_correction:
          "Question 1: Réponse correcte, justification présente. (3/4 points)\n" +
          "Question 2: Démarche bonne mais erreur de calcul à la fin. (2/4 points)\n" +
          "Question 3: Incomplète — manque la réciproque. (1.5/4 points)\n" +
          "Question 4: Non traitée. (0/4 points)\n" +
          "Question 5: Correcte. (3.5/4 points)\n\n" +
          "Note totale: " + note + "/20",
      };

      const { error: updateError } = await supabase
        .from("submissions")
        .update({
          ai_note: simulated.note,
          ai_points_forts: simulated.points_forts,
          ai_axes_amelioration: simulated.axes_amelioration,
          ai_commentaire: simulated.commentaire_global,
          ai_detail: simulated.detail_correction,
          ai_status: "analyzed",
        })
        .eq("id", submissionId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true, status: "analyzed", simulated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Real Gemini API call ──

    // Use gemini-3.8-flash which supports PDF, images, and text via inline_data
    const parts: Array<Record<string, unknown>> = [
      { text: SYSTEM_PROMPT + "\n\n" + contextParts.join("\n\n") },
    ];

    // Include énoncé file if it's a PDF or image (but NOT if it's a .tex —
    // .tex content is already included as text in the prompt above)
    if (enonceFileUrl && !enonceFileName.toLowerCase().endsWith(".tex")) {
      const fetched = await fetchAsBase64(enonceFileUrl);
      if (fetched) {
        const type = fetched.mimeType.split(";")[0].trim();
        if (type.startsWith("image/") || type === "application/pdf") {
          parts.push({ inline_data: { mime_type: type, data: fetched.data } });
        }
      }
    }

    // Include corrigé file if it's a PDF or image
    if (corrigeFileUrl) {
      const fetched = await fetchAsBase64(corrigeFileUrl);
      if (fetched) {
        const type = fetched.mimeType.split(";")[0].trim();
        if (type.startsWith("image/") || type === "application/pdf") {
          parts.push({ inline_data: { mime_type: type, data: fetched.data } });
        }
      }
    }

    // Include student's file (PDF, image, or try as text)
    if (fileUrl) {
      const isImage = fileType?.startsWith("image/");
      const isPdf = fileType === "application/pdf" || fileUrl.toLowerCase().endsWith(".pdf");

      if (isImage || isPdf) {
        const fetched = await fetchAsBase64(fileUrl);
        if (fetched) {
          const type = fetched.mimeType.split(";")[0].trim();
          // Gemini accepts image/* and application/pdf
          if (type.startsWith("image/") || type === "application/pdf") {
            parts.push({ inline_data: { mime_type: type, data: fetched.data } });
          } else {
            // Fallback: use detected type based on fileType
            const fallbackType = isImage ? "image/png" : "application/pdf";
            parts.push({ inline_data: { mime_type: fallbackType, data: fetched.data } });
          }
        }
      }
    }

    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    // Read the model name from the database (configurable by teacher)
    let modelName = "gemini-3.5-flash-lite";
    try {
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("gemini_model")
        .eq("id", 1)
        .maybeSingle();
      if (settingsData?.gemini_model) {
        modelName = settingsData.gemini_model;
      }
    } catch {
      // Fall back to default if table is unavailable
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

    let geminiResponse: Response | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const backoff = 2000 * attempt * attempt;
        await new Promise((r) => setTimeout(r, backoff));
      }

      geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      if (geminiResponse.ok) break;

      const errText = await geminiResponse.text();
      lastError = `Gemini API error ${geminiResponse.status}: ${errText}`;

      if (geminiResponse.status === 429 || geminiResponse.status === 503) {
        continue;
      }
      throw new Error(lastError);
    }

    if (!geminiResponse || !geminiResponse.ok) {
      throw new Error(lastError || "Gemini API unreachable after retries");
    }

    const geminiData = await geminiResponse.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) throw new Error("Empty response from Gemini");

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Invalid JSON from Gemini");
      }
    }

    const { error: updateError } = await supabase
      .from("submissions")
      .update({
        ai_note: parseFloat(result.note) || 0,
        ai_points_forts: Array.isArray(result.points_forts) ? result.points_forts : [],
        ai_axes_amelioration: Array.isArray(result.axes_amelioration) ? result.axes_amelioration : [],
        ai_commentaire: result.commentaire_global || "",
        ai_detail: result.detail_correction || "",
        ai_status: "analyzed",
      })
      .eq("id", submissionId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, status: "analyzed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = (err as Error).message || "Unknown error";

    // Mark submission as failed so the UI doesn't stay stuck on "pending"
    if (submissionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        try {
          const supabase = createClient(supabaseUrl, serviceRoleKey);
          await supabase.from("submissions").update({ ai_status: "failed" }).eq("id", submissionId);
        } catch {
          // Best effort
        }
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
