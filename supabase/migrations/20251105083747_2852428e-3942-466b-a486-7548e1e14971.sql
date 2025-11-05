-- Fix the match_medical_documents function to cast ts_rank result to double precision
CREATE OR REPLACE FUNCTION match_medical_documents(
  search_query text,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  category text,
  similarity double precision
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    medical_documents.id,
    medical_documents.title,
    medical_documents.content,
    medical_documents.category,
    ts_rank(medical_documents.search_vector, websearch_to_tsquery('english', search_query))::double precision as similarity
  FROM medical_documents
  WHERE medical_documents.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;