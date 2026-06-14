import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Calendar, MapPin, Receipt, ArrowRight } from 'lucide-react';
import { fmt, RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn } from '@/lib/utils';
import type { ResourceType } from '@/lib/types';

export default async function TransactionDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const id = params.id;

  const { data: tx } = await supabase
    .from('transactions')
    .select(`
      *,
      creator:profiles(name),
      contributions:transaction_contributions(
        *,
        game_account:game_accounts(name)
      )
    `)
    .eq('id', id)
    .single();

  if (!tx) notFound();

  const date = new Date(tx.created_at);
  const displayDate = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center gap-4">
        <Link href="/transactions" className="p-2 bg-white border border-[#E8DDC9] text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight flex items-center gap-3">
            Transaksi #{String(tx.id).padStart(4, '0')}
            <span className="badge-admin bg-[#2BB673] text-white">Selesai</span>
          </h1>
          <p className="text-sm text-[#6B8079] mt-1">{displayDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info Card */}
        <div className="card p-6 flex flex-col gap-4 bg-gradient-to-br from-white to-[#FAF5EA]">
          <div className="flex items-center justify-between border-b border-[#E8DDC9] pb-3">
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#2BB673]" /> Detail Pengiriman
            </h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0E3D40]/5 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#0E3D40]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider">Oleh (Kasir)</p>
                <p className="font-semibold text-[#0E3D40]">{tx.creator?.name || 'Unknown'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D9745A]/10 flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4 text-[#D9745A]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider">Dikirim Ke</p>
                <p className="font-semibold text-[#0E3D40]">{tx.to_name}</p>
                {tx.kingdom && <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#E8DDC9] mt-1 inline-block">{tx.kingdom}</span>}
              </div>
            </div>

            {tx.notes && (
              <div className="mt-2 p-3 bg-white border border-[#E8DDC9] rounded-lg text-sm text-[#6B8079] italic">
                "{tx.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Totals Card */}
        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#E8DDC9] pb-3">
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Ringkasan Resource</h3>
          </div>

          <div className="space-y-3">
            {RESOURCES.map(res => {
              const rSent = tx[`total_${res}_sent` as keyof typeof tx] as number;
              const rRecv = tx[`total_${res}_received` as keyof typeof tx] as number;
              if (rSent <= 0) return null;

              return (
                <div key={res} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></div>
                    <span className="text-sm font-bold text-[#6B8079] capitalize">{res}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-extrabold text-[#2BB673]">+{fmt(rRecv)}</div>
                    <div className="font-mono text-[10px] text-[#D9745A]">Gross: {fmt(rSent)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-[#E8DDC9] flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider">Estimasi Nilai</p>
              <p className="font-mono text-xl font-extrabold text-[#0E3D40] tracking-tight">Rp {fmt(tx.total_estimated_value)}</p>
            </div>
            {/* calculate average tax */}
            <div className="text-right">
               <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider">Est. Tax</p>
               <p className="font-mono text-sm font-bold text-[#0E3D40]">
                 {Math.round(((tx.total_food_sent + tx.total_wood_sent + tx.total_stone_sent + tx.total_gold_sent) - (tx.total_food_received + tx.total_wood_received + tx.total_stone_received + tx.total_gold_received)) / Math.max(1, (tx.total_food_received + tx.total_wood_received + tx.total_stone_received + tx.total_gold_received)) * 100)}%
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown per Account */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-[#FAF5EA] border-b border-[#E8DDC9]">
          <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Rincian per Akun</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-white border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Akun</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></div>
                      {RESOURCE_LABELS[res]}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-center">Trips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {tx.contributions?.map((c: any) => (
                <tr key={c.id} className="hover:bg-[#FAF5EA]/50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#0E3D40]">{c.game_account?.name || 'Unknown'}</div>
                    <div className="text-[10px] text-[#6B8079]">Tax: {(c.tax_rate * 100).toFixed(0)}%</div>
                  </td>
                  {RESOURCES.map(res => {
                    const cSent = c[`${res}_sent` as keyof typeof c] as number;
                    const cRecv = c[`${res}_received` as keyof typeof c] as number;
                    if (cSent <= 0) return <td key={res} className="py-3 px-4 text-right text-[#6B8079]/30">-</td>;
                    return (
                      <td key={res} className="py-3 px-4 text-right">
                        <div className="font-mono text-[#D9745A] font-bold text-[13px] text-right">-{fmt(cSent)}</div>
                        <div className="font-mono text-[#2BB673] font-semibold text-[10px] mt-0.5 text-right">+{fmt(cRecv)}</div>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-[#0E3D40]/10 text-[#0E3D40] font-bold text-xs">
                      {c.total_trips}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
