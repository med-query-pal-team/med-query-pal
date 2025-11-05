import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId } = await req.json();
    console.log('Received message:', message);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Generate embedding for the user's query
    console.log('Generating embedding for query...');
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: message,
        model: 'text-embedding-3-small'
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Embedding API error:', error);
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;
    console.log('Embedding generated successfully');

    // Step 2: Search for relevant medical documents using vector similarity
    console.log('Searching for relevant medical documents...');
    const { data: relevantDocs, error: searchError } = await supabase.rpc(
      'match_medical_documents',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 3
      }
    );

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    console.log('Found relevant documents:', relevantDocs?.length || 0);

    // Step 3: Construct context from relevant documents
    const context = relevantDocs && relevantDocs.length > 0
      ? relevantDocs.map((doc: any) => 
          `Document: ${doc.title} (Category: ${doc.category})\n${doc.content}`
        ).join('\n\n')
      : 'No specific medical information found in the knowledge base.';

    // Step 4: Get conversation history
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversationId) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(10);
      
      conversationHistory = messages || [];
    }

    // Step 5: Generate AI response using RAG
    console.log('Generating AI response...');
    const systemPrompt = `You are a helpful medical assistant. You provide information based on medical knowledge, but you always remind users that your advice is for informational purposes only and they should consult with healthcare professionals for medical decisions.

When answering questions, use the following medical knowledge context if relevant:

${context}

If the context doesn't contain relevant information, provide general medical knowledge but emphasize the importance of consulting a healthcare provider. Always be compassionate, clear, and professional.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI service credits depleted. Please add credits to continue.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('AI service error');
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in medical-rag-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
