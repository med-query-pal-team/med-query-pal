import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthForm } from '@/components/AuthForm';
import { ChatInterface } from '@/components/ChatInterface';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Generate embeddings on first load
    const generateEmbeddings = async () => {
      try {
        await supabase.functions.invoke('generate-embeddings');
      } catch (error) {
        console.error('Error generating embeddings:', error);
      }
    };
    
    if (session) {
      generateEmbeddings();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return session ? <ChatInterface /> : <AuthForm />;
};

export default Index;
