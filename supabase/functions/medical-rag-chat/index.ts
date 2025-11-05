import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const GEMINI_API_URL = "https://your-gemini-endpoint.com/v1/chat/completions"; 
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search relevant medical docs
    const { data: relevantDocs, error: searchError } = await supabase.rpc(
      "match_medical_documents",
      {
        search_query: message,
        match_count: 3,
      },
    );

    if (searchError) throw searchError;

    const context = relevantDocs?.length
      ? relevantDocs.map(
          (doc: any) =>
            `Document: ${doc.title} (Category: ${doc.category})\n${doc.content}`,
        ).join("\n\n")
      : "No specific medical information found.";

    // previous messages
    let conversationHistory = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(10);
      conversationHistory = messages || [];
    }

    const systemPrompt =
      `You are a medical assistant. Provide medical guidance based on the context below, but remind the user this is not medical advice and they should consult a doctor.\n\nContext:\n${context}`;

    // Gemini API call
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
