'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { log } from '@/lib/logger';

export default function DeleteButton({ txId, txCode }: { txId: number; txCode: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('transactions').delete().eq('id', txId);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
      setDeleting(false);
      setConfirm(false);
    } else {
      await log('transaction.delete', { transaction_id: txId, code: txCode }, user?.id);
      router.push('/transactions');
      router.refresh();
    }
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Hapus
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
      <span className="text-xs font-semibold text-red-700">Yakin hapus transaksi ini?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="ml-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-60 cursor-pointer inline-flex items-center gap-1"
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Ya, Hapus
      </button>
      <button
        type="button"
        onClick={() => setConfirm(false)}
        className="px-2.5 py-1 rounded-lg text-xs font-bold text-[#6B8079] hover:bg-white transition-colors cursor-pointer"
      >
        Batal
      </button>
    </div>
  );
}
