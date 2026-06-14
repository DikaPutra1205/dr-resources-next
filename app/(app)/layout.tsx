import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppLayoutClient from '@/components/layout/AppLayoutClient';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <AppLayoutClient profile={profile}>
      {children}
    </AppLayoutClient>
  );
}
