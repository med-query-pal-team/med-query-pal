-- Remove vector embedding column and add full-text search
ALTER TABLE medical_documents DROP COLUMN IF EXISTS embedding;

-- Add a text search vector column
ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS medical_documents_search_idx ON medical_documents USING GIN(search_vector);

-- Update existing rows to generate search vectors
UPDATE medical_documents 
SET search_vector = to_tsvector('english', title || ' ' || content || ' ' || category);

-- Create trigger to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION update_medical_documents_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', NEW.title || ' ' || NEW.content || ' ' || NEW.category);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_medical_documents_search_vector_trigger ON medical_documents;
CREATE TRIGGER update_medical_documents_search_vector_trigger
BEFORE INSERT OR UPDATE ON medical_documents
FOR EACH ROW
EXECUTE FUNCTION update_medical_documents_search_vector();

-- Replace the vector search function with full-text search
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    medical_documents.id,
    medical_documents.title,
    medical_documents.content,
    medical_documents.category,
    ts_rank(medical_documents.search_vector, websearch_to_tsquery('english', search_query)) as similarity
  FROM medical_documents
  WHERE medical_documents.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;