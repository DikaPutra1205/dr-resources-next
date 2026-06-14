'use client';

import { useState, useEffect } from 'react';
import { CalcTotals, AccountCalcData, ResourcePrices } from '@/lib/types';
import { RESOURCES, RESOURCE_DOT, RESOURCE_LABELS, cn, fmt } from '@/lib/utils';
import { AlertTriangle, Package, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { calculateTripBreakdown } from '@/lib/calculator';

export default function ResultsTable({ result, prices, activeTab, supabase, userId, kingdomId, kingdoms }: any) {
  const router = useRouter();
  const { accountsData, totals, warnings } = result;
  
  // State
  const [saving, setSaving] = useState(false);
  const [toName, setToName] = useState('');
  const [notes, setNotes] = useState('');
  const [sentAt, setSentAt] = useState('');
  
  // Trip Modal State
  const [activeTripDetails, setActiveTripDetails] = useState<any[] | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);

  // Default sentAt to Asia/Jakarta local time (UTC+7)
  useEffect(() => {
    const tzOffset = 7 * 60; // Jakarta UTC+7 in minutes
    const localTime = new Date(Date.now() + tzOffset * 60 * 1000);
    const isoString = localTime.toISOString().substring(0, 16); // "YYYY-MM-DDTHH:MM"
    setSentAt(isoString);
  }, []);

  if (!totals || (totals.total_trips === 0 && warnings.length === 0)) {
    return null; // Empty state
  }

  async function handleSaveTransaction() {
    if (!toName) return alert('Nama penerima harus diisi.');
    if (!sentAt) return alert('Tanggal & waktu pengiriman harus diisi.');
    if (!confirm('Simpan transaksi dan kurangi stok akun?')) return;
    
    setSaving(true);
    
    // Resolve kingdom name
    const activeKingdom = kingdoms?.find((k: any) => k.id === kingdomId);
    const kingdomName = activeKingdom ? activeKingdom.name : null;

    // 1. Create Transaction
    const { data: tx, error: txErr } = await supabase.from('transactions').insert({
      created_by: userId,
      to_name: toName,
      notes: notes || null,
      sent_at: new Date(sentAt).toISOString(),
      kingdom: kingdomName,
      total_food_sent: totals.food_sent,
      total_wood_sent: totals.wood_sent,
      total_stone_sent: totals.stone_sent,
      total_gold_sent: totals.gold_sent,
      total_food_received: totals.food_received,
      total_wood_received: totals.wood_received,
      total_stone_received: totals.stone_received,
      total_gold_received: totals.gold_received,
      total_estimated_value: totals.estimated_value
    }).select('id').single();

    if (txErr || !tx) {
      alert('Gagal membuat transaksi: ' + txErr?.message);
      setSaving(false);
      return;
    }

    // 2. Insert Contributions & Update Stock
    const contribs = [];
    for (const accData of accountsData as AccountCalcData[]) {
      const isContributing = RESOURCES.some(res => accData.resources[res].required_gross > 0);
      if (!isContributing) continue;

      const foodGross = accData.resources.food.required_gross;
      const woodGross = accData.resources.wood.required_gross;
      const stoneGross = accData.resources.stone.required_gross;
      const goldGross = accData.resources.gold.required_gross;

      const tripsFood = accData.resources.food.trips;
      const tripsWood = accData.resources.wood.trips;
      const tripsStone = accData.resources.stone.trips;
      const tripsGold = accData.resources.gold.trips;
      const maxTrips = Math.max(tripsFood, tripsWood, tripsStone, tripsGold);

      // Generate trip breakdown
      const tripDetails = calculateTripBreakdown(
        accData.capacity_per_trip,
        accData.tax_rate,
        foodGross,
        woodGross,
        stoneGross,
        goldGross
      );

      contribs.push({
        transaction_id: tx.id,
        game_account_id: accData.account.id,
        food_sent: foodGross,
        wood_sent: woodGross,
        stone_sent: stoneGross,
        gold_sent: goldGross,
        food_received: accData.resources.food.required_net,
        wood_received: accData.resources.wood.required_net,
        stone_received: accData.resources.stone.required_net,
        gold_received: accData.resources.gold.required_net,
        tax_rate: accData.tax_rate,
        total_trips: maxTrips,
        trip_details: tripDetails,
      });

      // Reduce stock in DB
      for (const res of RESOURCES) {
        const gross = accData.resources[res].required_gross;
        if (gross > 0) {
          const oldStock = accData.resources[res].stock;
          const newStock = Math.max(0, oldStock - gross);
          await supabase.from('resource_stocks').update({ [res]: newStock }).eq('game_account_id', accData.account.id);
        }
      }
    }

    const { error: cErr } = await supabase.from('transaction_contributions').insert(contribs);
    if (cErr) {
      alert('Gagal menyimpan kontribusi transaksi: ' + cErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert('Transaksi berhasil disimpan!');
    router.push('/transactions');
    router.refresh();
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* WARNINGS */}
      {warnings.length > 0 && (
        <div className="bg-[#D9745A]/10 border-l-4 border-[#D9745A] p-4 rounded-r-xl">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-[#D9745A] mr-3 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-[#D9745A]">Peringatan Kekurangan Stok</h4>
              <ul className="mt-2 text-xs text-[#D9745A]/80 list-disc list-inside space-y-1">
                {warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* RESULT TABLE */}
      <div className="bg-white rounded-xl border border-[#E8DDC9] shadow-sm overflow-hidden animate-fadeIn">
        <div className="bg-[#FAF5EA] px-4 py-3 border-b border-[#E8DDC9] flex justify-between items-center">
          <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-[#2BB673]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Rencana Kontribusi Akun
          </h3>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#2BB673]/10 text-[#2BB673] rounded-full">
            {accountsData.filter((accData: AccountCalcData) => RESOURCES.some(res => accData.resources[res].required_gross > 0)).length} Akun
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA]/50 border-b border-[#E8DDC9] text-[#6B8079] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Akun & Pemilik</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-2.5 px-3 text-right capitalize">{res} (Bersih)</th>
                ))}
                <th className="py-2.5 px-3 text-center">Trip</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {accountsData.map((accData: AccountCalcData) => {
                const isUsed = RESOURCES.some(res => accData.resources[res].required_gross > 0);
                if (!isUsed) return null;

                const maxTrips = Math.max(...RESOURCES.map(r => accData.resources[r].trips));

                return (
                  <tr key={accData.account.id} className="hover:bg-[#FAF5EA]/20 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#0E3D40] text-xs">{accData.account.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                        <span className="px-1 py-0.1 rounded text-[8px] font-bold uppercase tracking-wider bg-[#0E3D40]/10 text-[#0E3D40]">
                          {accData.account.type}
                        </span>
                        <span className="text-[#6B8079] font-medium">
                          {(accData.account as any).profile?.name || 'N/A'}
                        </span>
                        <span className="text-[#E8DDC9]">|</span>
                        <span className="text-[#5C6E6E]">
                          K: {typeof accData.account.kingdom === 'object' ? accData.account.kingdom?.name : (accData.account.kingdom || 'N/A')}
                        </span>
                        <span className="text-[#E8DDC9]">|</span>
                        <span className="text-[#D9745A] font-bold">
                          Pajak: {Math.round(accData.tax_rate * 100)}%
                        </span>
                      </div>
                    </td>
                    
                    {RESOURCES.map(res => {
                      const r = accData.resources[res];
                      if (r.required_gross <= 0) return <td key={res} className="py-2.5 px-3 text-right text-[#6B8079]/30">-</td>;
                      
                      return (
                        <td key={res} className="py-2.5 px-3 text-right whitespace-nowrap font-medium font-mono">
                          <span className="text-[#2BB673] font-bold block">+{fmt(r.required_net)}</span>
                          <span className="text-[9px] text-[#6B8079]/75 block">Gross: {fmt(r.required_gross)}</span>
                        </td>
                      );
                    })}
                    
                    <td className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-[#0E3D40]">
                      {maxTrips}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {maxTrips > 0 ? (
                        <button 
                          type="button" 
                          onClick={() => {
                            const details = calculateTripBreakdown(
                              accData.capacity_per_trip,
                              accData.tax_rate,
                              accData.resources.food.required_gross,
                              accData.resources.wood.required_gross,
                              accData.resources.stone.required_gross,
                              accData.resources.gold.required_gross
                            );
                            setActiveTripDetails(details);
                            setShowTripModal(true);
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-[#E8DDC9] hover:bg-[#FAF5EA] text-[#0E3D40] font-bold text-[10px] transition-colors focus:outline-none cursor-pointer"
                        >
                          Detail Trip
                        </button>
                      ) : (
                        <span className="text-[#6B8079]/30">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY & RECIEVER FORM GRID */}
      {totals.total_trips > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          
          {/* Summary Panel */}
          <div className="bg-white p-6 rounded-xl border border-[#E8DDC9] shadow-sm space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider mb-4 border-b border-[#E8DDC9]/60 pb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-[#2BB673]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                </svg>
                Ringkasan Rencana Transfer
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {RESOURCES.map(res => (
                  <div key={res} className="p-3 bg-[#FAF5EA]/50 rounded-lg border border-[#E8DDC9]/50">
                    <span className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider block mb-1">
                      {RESOURCE_LABELS[res]} Bersih
                    </span>
                    <div className={cn("font-bold text-sm font-mono", {
                      "text-emerald-800": res === 'food',
                      "text-amber-800": res === 'wood',
                      "text-slate-800": res === 'stone',
                      "text-yellow-800": res === 'gold'
                    })}>
                      {fmt(totals[`${res}_received`] || 0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sage Green Grand Total Card */}
            <div className="mt-6 p-4 bg-[#7A9A95]/15 border border-[#7A9A95] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#4E6763] uppercase tracking-wider block mb-0.5">Estimasi Nilai Total</span>
                <span className="text-[10px] text-[#6B8079] font-medium">Berdasarkan harga kingdom terpilih</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-[#234E49] font-mono whitespace-nowrap">
                  Rp {fmt(totals.estimated_value)}
                </span>
              </div>
            </div>
          </div>

          {/* Receiver Form Panel */}
          <div className="bg-white p-6 rounded-xl border border-[#E8DDC9] shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/60 pb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-[#2BB673]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Catat Transaksi Pengiriman
            </h3>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Nama Penerima</label>
              <input 
                type="text" 
                required 
                value={toName} 
                onChange={e => setToName(e.target.value)} 
                placeholder="Contoh: Akun Utama / Nama Player" 
                className="w-full rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Tanggal & Waktu Pengiriman</label>
              <input 
                type="datetime-local" 
                required
                value={sentAt}
                onChange={e => setSentAt(e.target.value)}
                className="w-full rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Catatan (Opsional)</label>
              <textarea 
                rows={2}
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Catatan tambahan..." 
                className="w-full rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none" 
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={handleSaveTransaction} 
                disabled={saving || !toName} 
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-[#2BB673] hover:bg-[#23945d] text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BB673]/50 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border disabled:border-gray-300/50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" /> Menyimpan...
                  </span>
                ) : (
                  <>Catat Transaksi</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRIP DETAILS MODAL */}
      {showTripModal && activeTripDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3D40]/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-[#E8DDC9] bg-[#FAF5EA] flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#0E3D40]">Rincian Pengiriman per Trip</h2>
              <button 
                type="button" 
                onClick={() => setShowTripModal(false)} 
                className="text-[#6B8079] hover:text-[#0E3D40] transition-colors focus:outline-none cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {activeTripDetails.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeTripDetails.map((trip: any) => (
                    <div key={trip.trip} className="bg-[#FAF5EA]/30 p-3 rounded-lg border border-[#E8DDC9]/70 space-y-2">
                      <span className="inline-block bg-[#0E3D40] text-white font-bold text-[9px] px-2 py-0.5 rounded-full">
                        Trip #{trip.trip}
                      </span>
                      <div className="space-y-1">
                        {Object.entries(trip.resources).map(([resName, resVal]: any) => (
                          <div key={resName} className="flex items-center justify-between text-xs">
                            <span className="capitalize font-semibold text-[#6B8079] flex items-center gap-1">
                              <span className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[resName as any])}></span>
                              {resName}
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-[#0E3D40] font-mono">{fmt(resVal.sent)}</span>
                              <span className="text-[9px] text-[#6B8079]/70 font-mono block">Net: {fmt(resVal.received)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center text-[#6B8079] italic py-4">Tidak ada detail trip untuk kontribusi ini.</p>
              )}
            </div>

            <div className="p-4 border-t border-[#E8DDC9] flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowTripModal(false)} 
                className="px-4 py-2 bg-[#0E3D40] hover:bg-[#1a5559] text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors focus:outline-none cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
