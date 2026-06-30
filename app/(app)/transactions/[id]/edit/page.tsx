import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import EditTransactionForm from './EditTransactionForm';
import { txCode } from '@/lib/utils';

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Admin only
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single();
  if (profile?.role !== 'admin') redirect(`/transactions/${id}`);

  const { data: tx } = await supabase
    .from('transactions')
    .select('id, to_name, notes, sent_at, status, created_at')
    .eq('id', id)
    .single();

  if (!tx) notFound();

  return (
    <EditTransactionForm
      tx={tx}
      txCode={txCode(tx.created_at)}
    />
  );
}
