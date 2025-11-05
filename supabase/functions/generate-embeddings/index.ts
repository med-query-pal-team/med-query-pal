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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all documents without embeddings
    const { data: documents, error: fetchError } = await supabase
      .from('medical_documents')
      .select('id, title, content')
      .is('embedding', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All documents already have embeddings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating embeddings for ${documents.length} documents...`);

    // Generate embeddings for each document
    for (const doc of documents) {
      const text = `${doc.title}\n\n${doc.content}`;
      
      const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        }),
      });

      if (!embeddingResponse.ok) {
        console.error(`Failed to generate embedding for document ${doc.id}`);
        continue;
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Update document with embedding
      const { error: updateError } = await supabase
        .from('medical_documents')
        .update({ embedding })
        .eq('id', doc.id);

      if (updateError) {
        console.error(`Failed to update document ${doc.id}:`, updateError);
      } else {
        console.log(`Successfully generated embedding for: ${doc.title}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Successfully generated embeddings for ${documents.length} documents` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating embeddings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
