import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Receipt, ArrowRight, ImageIcon, TrendingUp, Users, Wallet } from 'lucide-react';
import { fmt, RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn, txCode, STATUS_CONFIG, TransactionStatus } from '@/lib/utils';
import type { ResourceType } from '@/lib/types';

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: tx } = await supabase
    .from('transactions')
    .select(`
      *,
      contributions:transaction_contributions(
        *,
        profile:profiles(name)
      ),
      commissions:transaction_commissions(
        *,
        profile:profiles(name)
      ),
      fee_deductions:transaction_fee_deductions(*)
    `)
    .eq('id', id)
    .single();

  if (!tx) notFound();

  const date = new Date(tx.created_at);
  const displayDate = date.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }) + ', ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const hasRates = tx.rate_food > 0 || tx.rate_wood > 0 || tx.rate_stone > 0 || tx.rate_gold > 0;
  const rates: Record<string, number> = {
    food: tx.rate_food, wood: tx.rate_wood, stone: tx.rate_stone, gold: tx.rate_gold
  };

  const fees = (tx.fee_deductions || []) as any[];
  const totalFees = fees.reduce((s: number, f: any) => s + Number(f.amount), 0);
  const allCommissions = (tx.commissions || []) as any[];
  const totalCommission = allCommissions.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const feePerAdmin = allCommissions.length > 0 ? totalFees / allCommissions.length : 0;

  const allContributions = (tx.contributions || []) as any[];
  const totalContrib = allContributions.reduce((s, c) => {
    return s + RESOURCES.reduce((s2, res) => {
      return s2 + (Number(c[`${res}_received`]) / 1_000_000) * rates[res];
    }, 0);
  }, 0);

  const netGrandTotal = totalContrib + totalCommission - totalFees;

  // Build rincian transfer: merge contributors + commissions by user_id
  const transferMap = new Map<string, { name: string; contrib: number; comm: number; feeShare: number }>();

  allContributions.forEach((c: any) => {
    const uid = c.user_id;
    const cVal = RESOURCES.reduce((s, res) => s + (Number(c[`${res}_received`]) / 1_000_000) * rates[res], 0);
    const existing = transferMap.get(uid);
    if (existing) {
      existing.contrib += cVal;
    } else {
      transferMap.set(uid, { name: c.profile?.name || 'Unknown', contrib: cVal, comm: 0, feeShare: 0 });
    }
  });

  allCommissions.forEach((c: any) => {
    const uid = c.user_id;
    const amt = Number(c.amount);
    const existing = transferMap.get(uid);
    if (existing) {
      existing.comm += amt;
      existing.feeShare += feePerAdmin;
    } else {
      transferMap.set(uid, { name: c.profile?.name || 'Unknown', contrib: 0, comm: amt, feeShare: feePerAdmin });
    }
  });

  const transferEntries = Array.from(transferMap.entries())
    .map(([uid, data]) => ({
      uid,
      ...data,
      total: data.contrib + data.comm - data.feeShare,
    }))
    .filter(e => e.total > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Link href="/transactions" className="p-2 bg-white border border-[#E8DDC9] text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight flex items-center gap-3">
            {txCode(tx.created_at)}
            {(() => {
              const s = STATUS_CONFIG[(tx.status as TransactionStatus) || 'done'];
              return (
                <span className={`text-xs px-2.5 py-1 rounded-full border font-bold inline-flex items-center gap-1.5 ${s.cls}`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              );
            })()}
          </h1>
          <p className="text-sm text-[#6B8079] mt-1">{displayDate}</p>
        </div>
      </div>

      {/* Top row: Info + Rates + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Detail */}
        <div className="card p-5 space-y-4">
          <h3 className="text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5 text-[#2BB673]" /> Detail
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#D9745A]/10 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowRight className="w-3.5 h-3.5 text-[#D9745A]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider">Buyer</p>
                <p className="font-bold text-[#0E3D40]">{tx.to_name}</p>
                {tx.kingdom && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#E8DDC9] inline-block mt-0.5 text-[#5C6E6E]">
                    KD {tx.kingdom}
                  </span>
                )}
              </div>
            </div>

            {tx.notes && (
              <div className="mt-2 p-3 bg-[#FAF5EA] border border-[#E8DDC9] rounded-lg text-xs text-[#6B8079] italic">
                "{tx.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Rates */}
        <div className="card p-5 space-y-4">
          <h3 className="text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#2BB673]" /> Rate (Rp/juta)
          </h3>
          {hasRates ? (
            <div className="grid grid-cols-2 gap-2">
              {RESOURCES.map(res => (
                <div key={res} className="flex items-center justify-between bg-[#FAF5EA] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res])} />
                    <span className="text-[10px] font-bold text-[#6B8079] uppercase">{RESOURCE_LABELS[res]}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-[#0E3D40]">
                    {rates[res] > 0 ? fmt(rates[res]) : '-'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6B8079]">Rate tidak dicatat.</p>
          )}
        </div>

        {/* Ringkasan Nilai */}
        <div className="card p-5 bg-[#0E3D40] space-y-3">
          <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Ringkasan Nilai</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Kontribusi</span>
              <span className="font-mono text-sm font-bold text-white">Rp {fmt(totalContrib)}</span>
            </div>
            {totalCommission > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Komisi Pengurus</span>
                <span className="font-mono text-sm font-bold text-[#2BB673]">+ Rp {fmt(totalCommission)}</span>
              </div>
            )}
            {totalFees > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">Potongan Biaya</span>
                <span className="font-mono text-sm font-bold text-[#D9745A]">- Rp {fmt(totalFees)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 mt-1 flex items-end justify-between">
              <span className="text-[10px] text-white/50 uppercase tracking-wider font-bold">Total Bersih</span>
              <span className="font-mono text-xl font-black text-white">Rp {fmt(netGrandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kontributor */}
      {allContributions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-[#0E3D40] border-b border-[#0E3D40]">
            <Users className="w-4 h-4 text-white/70" />
            <h3 className="text-sm font-bold text-white">Kontributor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] text-[#5C6E6E] text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-5 text-left font-bold">Pemilik</th>
                  {RESOURCES.map(res => (
                    <th key={res} className="py-2.5 px-4 text-right font-bold">
                      <div className="flex items-center justify-end gap-1">
                        <div className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res])} />
                        {RESOURCE_LABELS[res]}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-5 text-right font-bold">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {allContributions.map((c: any, idx: number) => {
                  const cVal = RESOURCES.reduce((s, res) => {
                    const mil = Number(c[`${res}_received`]) / 1_000_000;
                    return s + mil * rates[res];
                  }, 0);
                  return (
                    <tr key={c.id} className={cn(
                      'hover:bg-[#FAF5EA]/50 transition-colors',
                      idx !== allContributions.length - 1 && 'border-b border-[#E8DDC9]/50'
                    )}>
                      <td className="py-3 px-5">
                        <span className="font-bold text-[#0E3D40]">{c.profile?.name || 'Unknown'}</span>
                      </td>
                      {RESOURCES.map(res => {
                        const val = Number(c[`${res}_received`]);
                        return (
                          <td key={res} className="py-3 px-4 text-right font-mono">
                            {val > 0
                              ? <span className="font-semibold text-[#0E3D40]">{fmt(val / 1_000_000)}M</span>
                              : <span className="text-[#6B8079]/30">-</span>
                            }
                          </td>
                        );
                      })}
                      <td className="py-3 px-5 text-right">
                        <span className="font-mono font-bold text-[#2BB673]">Rp {fmt(cVal)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Komisi Pengurus */}
      {allCommissions.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 bg-[#FAF5EA] border-b border-[#E8DDC9]">
            <h3 className="text-sm font-bold text-[#0E3D40]">Komisi Pengurus</h3>
          </div>
          <div className="divide-y divide-[#E8DDC9]/50">
            {allCommissions.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#FAF5EA]/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#0E3D40]/10 flex items-center justify-center">
                    <span className="text-[9px] font-black text-[#0E3D40]">
                      {(c.profile?.name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="font-semibold text-[#0E3D40] text-sm">{c.profile?.name || 'Unknown'}</span>
                </div>
                <span className="font-mono font-bold text-[#D9745A]">Rp {fmt(c.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-[#FAF5EA] font-bold">
              <span className="text-xs text-[#5C6E6E] uppercase tracking-wider">Total Komisi</span>
              <span className="font-mono font-black text-[#D9745A]">Rp {fmt(totalCommission)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Potongan Biaya */}
      {fees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 bg-[#D9745A]/10 border-b border-[#D9745A]/20">
            <h3 className="text-sm font-bold text-[#D9745A]">Potongan Biaya</h3>
          </div>
          <div className="divide-y divide-[#E8DDC9]/50">
            {fees.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-[#0E3D40]">{f.label}</span>
                <span className="font-mono font-bold text-[#D9745A]">Rp {fmt(f.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3 bg-[#FAF5EA] font-bold">
              <span className="text-xs text-[#5C6E6E] uppercase tracking-wider">Total Potongan</span>
              <span className="font-mono font-black text-[#D9745A]">Rp {fmt(totalFees)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rincian Transfer */}
      {transferEntries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0E3D40] border-b border-[#0E3D40]">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-white/70" />
              <h3 className="text-sm font-bold text-white">Rincian Transfer</h3>
            </div>
            <p className="text-[10px] text-white/50 mt-0.5">Total yang harus ditransfer ke masing-masing penerima</p>
          </div>
          <div className="divide-y divide-[#E8DDC9]/50">
            {transferEntries.map(e => (
              <div key={e.uid} className="flex items-center justify-between px-5 py-3.5 hover:bg-[#FAF5EA]/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#0E3D40]/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-[#0E3D40]">{e.name.charAt(0)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#0E3D40] text-sm">{e.name}</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {e.contrib > 0 && (
                        <span className="text-[10px] font-mono text-[#2BB673]">Kontribusi: Rp {fmt(e.contrib)}</span>
                      )}
                      {e.comm > 0 && (
                        <span className="text-[10px] font-mono text-[#D9745A]">Komisi: Rp {fmt(e.comm)}</span>
                      )}
                      {e.feeShare > 0 && (
                        <span className="text-[10px] font-mono text-red-400">Potongan: -Rp {fmt(e.feeShare)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-black text-[#0E3D40]">Rp {fmt(e.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bukti Transfer */}
      {tx.image_url && (
        <div className="card p-5 space-y-3">
          <h3 className="text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5" /> Bukti Transfer
          </h3>
          <a href={tx.image_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tx.image_url}
              alt="Bukti Transfer"
              className="rounded-xl border border-[#E8DDC9] w-full object-contain max-h-[500px] hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
        </div>
      )}
    </div>
  );
}
