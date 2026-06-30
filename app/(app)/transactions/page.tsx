import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Eye, Plus, MapPin } from 'lucide-react';
import { cn, fmt, RESOURCES, RESOURCE_DOT, txCode, STATUS_CONFIG, TransactionStatus } from '@/lib/utils';
import type { ResourceType } from '@/lib/types';

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id ?? '').single();
  const isAdmin = profile?.role === 'admin';

  const { data } = await supabase
    .from('transactions')
    .select('*')
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

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="card py-12 text-center">
            <p className="text-[#6B8079] text-sm">Belum ada transaksi.</p>
          </div>
        ) : transactions.map(tx => {
          const totalSent = RESOURCES.reduce((s, r) => s + Number(tx[`total_${r}_sent`] || 0), 0);
          const totalRecv = RESOURCES.reduce((s, r) => s + Number(tx[`total_${r}_received`] || 0), 0);
          const avgTax = totalSent > 0 ? Math.round(((totalSent - totalRecv) / totalSent) * 100) : 0;

          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}
              className="block bg-white rounded-xl border border-[#E8DDC9] shadow-sm hover:shadow-md hover:border-[#2BB673]/30 transition-all group">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-black text-[#0E3D40] text-xs bg-[#0E3D40]/5 px-2 py-0.5 rounded-lg tracking-wide">
                        {txCode(tx.created_at)}
                      </span>
                      {(() => {
                        const s = STATUS_CONFIG[(tx.status as TransactionStatus) || 'done'];
                        return (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        );
                      })()}
                      {tx.kingdom && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B8079] bg-[#FAF5EA] px-2 py-0.5 rounded-full">
                          <MapPin className="w-2.5 h-2.5" />
                          {tx.kingdom}
                        </span>
                      )}
                      <span className="text-[10px] text-[#6B8079] font-medium">
                        {new Date(tx.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Tujuan */}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-bold text-[#0E3D40] text-sm">{tx.to_name}</span>
                    </div>
                    {tx.notes && (
                      <p className="text-[11px] text-[#6B8079] mt-1 truncate">{tx.notes}</p>
                    )}
                  </div>

                  {/* Right: nilai + resources */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-black text-[#2BB673] text-base">Rp {fmt(tx.total_estimated_value)}</div>
                    <div className="text-[10px] text-[#6B8079] mt-0.5">Pajak ~{avgTax}%</div>
                  </div>
                </div>

                {/* Resource chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {RESOURCES.map(res => {
                    const sent = Number(tx[`total_${res}_sent`] || 0);
                    const recv = Number(tx[`total_${res}_received`] || 0);
                    if (sent <= 0 && recv <= 0) return null;
                    return (
                      <span key={res} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-[#FAF5EA] border border-[#E8DDC9]/50">
                        <span className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res as ResourceType])} />
                        {res.charAt(0).toUpperCase()}
                        <span className="text-[#2BB673]">{fmt(recv)}</span>
                        <span className="text-[#6B8079]/50">/</span>
                        <span className="text-[#D9745A]">{fmt(sent)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
