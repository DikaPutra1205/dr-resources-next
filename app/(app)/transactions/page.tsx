import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Eye, ArrowRight, Plus } from 'lucide-react';
import { fmt } from '@/lib/utils';

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single();
  const isAdmin = profile?.role === 'admin';

  const { data } = await supabase
    .from('transactions')
    .select(`
      *,
      creator:profiles(name)
    `)
    .order('created_at', { ascending: false });

  const transactions = (data || []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Riwayat Transaksi</h1>
          <p className="text-sm text-[#6B8079] mt-1">Daftar semua pengiriman resource yang telah tercatat.</p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/transactions/create"
            className="btn-primary shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah Transaksi Manual
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Tanggal / Waktu</th>
                <th className="py-3 px-4">Pengirim</th>
                <th className="py-3 px-4">Tujuan</th>
                <th className="py-3 px-4 text-right">Nilai Estimasi</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[#6B8079]">Belum ada transaksi.</td></tr>
              ) : transactions.map(tx => {
                const date = new Date(tx.created_at);
                const isToday = date.toDateString() === new Date().toDateString();
                const displayDate = isToday
                  ? `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                  : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                return (
                  <tr key={tx.id} className="hover:bg-[#FAF5EA]/50 transition-colors group">
                    <td className="py-3 px-4 font-mono text-xs text-[#0E3D40] font-bold">
                      #{String(tx.id).padStart(4, '0')}
                    </td>
                    <td className="py-3 px-4 text-[#6B8079] text-xs">
                      {displayDate}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0E3D40]/5 text-[#0E3D40] text-xs font-semibold">
                        {tx.creator?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-[#D9745A]" />
                        <span className="font-bold text-[#0E3D40]">{tx.to_name}</span>
                      </div>
                      {tx.notes && <div className="text-[10px] text-[#6B8079] mt-0.5 truncate max-w-[200px]">{tx.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-[#2BB673]">Rp {fmt(tx.total_estimated_value)}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/transactions/${tx.id}`}
                        className="inline-flex items-center justify-center p-1.5 text-[#6B8079] hover:text-[#0E3D40] hover:bg-[#E8DDC9]/50 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
