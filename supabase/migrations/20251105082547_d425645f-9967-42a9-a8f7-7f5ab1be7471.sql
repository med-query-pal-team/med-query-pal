-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Medical documents table for RAG knowledge base
CREATE TABLE public.medical_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medical_documents (public read for all users)
CREATE POLICY "Medical documents are viewable by everyone"
  ON public.medical_documents
  FOR SELECT
  USING (true);

-- RLS Policies for chat_conversations (users can only see their own)
CREATE POLICY "Users can view their own conversations"
  ON public.chat_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.chat_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.chat_conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.chat_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages from their conversations"
  ON public.chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
    )
  );

-- Create function for similarity search using vector embeddings
CREATE OR REPLACE FUNCTION match_medical_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity float
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
    1 - (medical_documents.embedding <=> query_embedding) as similarity
  FROM medical_documents
  WHERE 1 - (medical_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY medical_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for faster vector similarity search
CREATE INDEX ON public.medical_documents USING ivfflat (embedding vector_cosine_ops);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_medical_documents_updated_at
  BEFORE UPDATE ON public.medical_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample medical knowledge
INSERT INTO public.medical_documents (title, content, category) VALUES
('Common Cold', 'The common cold is a viral infection of the upper respiratory tract. Symptoms include runny nose, sore throat, cough, and congestion. Treatment focuses on rest, hydration, and symptom relief. Most colds resolve within 7-10 days.', 'General Medicine'),
('Hypertension Overview', 'Hypertension (high blood pressure) is when blood pressure readings consistently exceed 140/90 mmHg. Risk factors include obesity, smoking, high salt intake, and family history. Management includes lifestyle changes and medication if necessary.', 'Cardiology'),
('Diabetes Type 2', 'Type 2 diabetes is a chronic condition affecting blood sugar regulation. Symptoms include increased thirst, frequent urination, and fatigue. Management involves diet, exercise, blood sugar monitoring, and medication when needed.', 'Endocrinology'),
('Asthma Management', 'Asthma is a chronic respiratory condition causing airway inflammation and narrowing. Symptoms include wheezing, shortness of breath, and coughing. Treatment uses inhalers (bronchodilators and corticosteroids) and trigger avoidance.', 'Pulmonology'),
('Migraine Headaches', 'Migraines are severe, recurring headaches often accompanied by nausea, light sensitivity, and visual disturbances. Triggers vary but may include stress, certain foods, and hormonal changes. Treatment includes preventive medications and acute symptom relief.', 'Neurology');