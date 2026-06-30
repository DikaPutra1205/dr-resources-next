import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Plus, MapPin, ArrowUpRight, Receipt } from 'lucide-react';
import { cn, fmt, RESOURCES, RESOURCE_DOT, RESOURCE_LABELS, txCode, STATUS_CONFIG, TransactionStatus } from '@/lib/utils';
import type { ResourceType } from '@/lib/types';

const RESOURCE_BG: Record<string, string> = {
  food:  'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  wood:  'bg-amber-500/10 text-amber-700 border-amber-200',
  stone: 'bg-slate-500/10 text-slate-600 border-slate-200',
  gold:  'bg-yellow-500/10 text-yellow-700 border-yellow-200',
};

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

  const totalValue = transactions.reduce((s, tx) => s + Number(tx.total_estimated_value || 0), 0);
  const doneCount = transactions.filter(tx => (tx.status || 'done') === 'done').length;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold text-[#2BB673] uppercase tracking-[0.15em] mb-1">Manajemen</p>
          <h1 className="text-3xl font-extrabold text-[#0E3D40] tracking-tight leading-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-sm text-[#6B8079] mt-1.5">
            Semua pengiriman resource yang telah tercatat dalam sistem.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/transactions/create"
            className="btn-primary shrink-0 shadow-lg shadow-[#2BB673]/20"
          >
            <Plus className="w-4 h-4" /> Tambah Manual
          </Link>
        )}
      </div>

      {/* ── Stats Bar ── */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Transaksi', value: transactions.length.toString(), sub: 'entri tercatat' },
            { label: 'Selesai', value: doneCount.toString(), sub: `dari ${transactions.length} transaksi` },
            { label: 'Total Nilai', value: `Rp ${fmt(totalValue)}`, sub: 'akumulasi seluruh transaksi', mono: true },
          ].map(({ label, value, sub, mono }) => (
            <div key={label} className="bg-white rounded-2xl border border-[#E8DDC9] p-4 shadow-sm">
              <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider mb-1">{label}</p>
              <p className={`font-black text-[#0E3D40] text-xl leading-tight ${mono ? 'font-mono' : ''}`}>{value}</p>
              <p className="text-[10px] text-[#6B8079] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── List ── */}
      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8DDC9] py-16 text-center shadow-sm">
            <Receipt className="w-10 h-10 text-[#C4B998] mx-auto mb-3" />
            <p className="font-bold text-[#0E3D40]">Belum ada transaksi</p>
            <p className="text-sm text-[#6B8079] mt-1">Transaksi yang disimpan akan muncul di sini.</p>
          </div>
        ) : transactions.map(tx => {
          const totalSent = RESOURCES.reduce((s, r) => s + Number(tx[`total_${r}_sent`] || 0), 0);
          const totalRecv = RESOURCES.reduce((s, r) => s + Number(tx[`total_${r}_received`] || 0), 0);
          const avgTax = totalSent > 0 ? Math.round(((totalSent - totalRecv) / totalSent) * 100) : 0;
          const statusCfg = STATUS_CONFIG[(tx.status as TransactionStatus) || 'done'];
          const activeResources = RESOURCES.filter(r =>
            Number(tx[`total_${r}_sent`] || 0) > 0 || Number(tx[`total_${r}_received`] || 0) > 0
          );

          return (
            <Link key={tx.id} href={`/transactions/${tx.id}`}
              className="block bg-white rounded-2xl border border-[#E8DDC9] shadow-sm hover:shadow-md hover:border-[#2BB673]/40 transition-all duration-200 group overflow-hidden">

              {/* Top accent stripe by status */}
              <div className={`h-0.5 w-full ${
                (tx.status || 'done') === 'done' ? 'bg-emerald-400' :
                tx.status === 'cancelled' ? 'bg-red-400' : 'bg-amber-400'
              }`} />

              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">

                  {/* Left: Icon */}
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-[#0E3D40]/5 flex items-center justify-center group-hover:bg-[#2BB673]/10 transition-colors">
                    <Receipt className="w-5 h-5 text-[#0E3D40]/50 group-hover:text-[#2BB673] transition-colors" />
                  </div>

                  {/* Center: Main info */}
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-[10px] font-bold text-[#6B8079] bg-[#F5EFE0] px-2 py-0.5 rounded-md tracking-wider">
                        {txCode(tx.created_at)}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </span>
                      {tx.kingdom && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#6B8079] bg-[#FAF5EA] px-2 py-0.5 rounded-full border border-[#E8DDC9]">
                          <MapPin className="w-2.5 h-2.5" />
                          {tx.kingdom}
                        </span>
                      )}
                      <span className="text-[10px] text-[#9CA8A0]">
                        {new Date(tx.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {/* Buyer name */}
                    <p className="text-base font-extrabold text-[#0E3D40] leading-tight truncate">
                      {tx.to_name}
                    </p>
                    {tx.notes && (
                      <p className="text-xs text-[#6B8079] mt-0.5 truncate italic">{tx.notes}</p>
                    )}

                    {/* Resource chips */}
                    {activeResources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {activeResources.map(res => {
                          const recv = Number(tx[`total_${res}_received`] || 0);
                          const sent = Number(tx[`total_${res}_sent`] || 0);
                          return (
                            <div key={res} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${RESOURCE_BG[res]}`}>
                              <span className={cn('w-2 h-2 rounded-full shrink-0', RESOURCE_DOT[res as ResourceType])} />
                              <span className="text-[10px] font-black uppercase tracking-wide opacity-60">{RESOURCE_LABELS[res].slice(0, 1)}</span>
                              <span className="font-mono">{fmt(recv > 0 ? recv : sent)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Value */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <div className="font-mono font-black text-[#0E3D40] text-lg leading-tight group-hover:text-[#2BB673] transition-colors">
                      Rp {fmt(tx.total_estimated_value)}
                    </div>
                    {avgTax > 0 && (
                      <div className="text-[10px] text-[#6B8079] bg-[#FAF5EA] px-2 py-0.5 rounded-full">
                        Pajak ~{avgTax}%
                      </div>
                    )}
                    <ArrowUpRight className="w-4 h-4 text-[#C4B998] group-hover:text-[#2BB673] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all mt-1" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
