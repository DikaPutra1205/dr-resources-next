'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalcTotals, AccountCalcData, ResourcePrices, ResourceType } from '@/lib/types';
import { RESOURCES, RESOURCE_DOT, RESOURCE_LABELS, cn, fmt, formatInput, parseShorthand } from '@/lib/utils';
import { log } from '@/lib/logger';
import { AlertTriangle, Info, Package, Loader2, Upload, X as XIcon, Coins, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { calculateSequentialTrips } from '@/lib/calculator';

interface CommissionEntry {
  uid: string;
  name: string;
  rate: string;
}

interface FeeDeduction {
  tempId: string;
  label: string;
  amount: string;
}

function parseNum(val: string): number {
  return parseShorthand(val);
}

export default function ResultsTable({ result, prices, activeTab, supabase, userId, kingdomId, kingdoms, hasAnyInput }: any) {
  const router = useRouter();
  const { accountsData, totals, warnings = [] } = result;

  // Form state
  const [saving, setSaving] = useState(false);
  const [toName, setToName] = useState('');
  const [notes, setNotes] = useState('');
  const [sentAt, setSentAt] = useState('');
  const [status, setStatus] = useState<'pending' | 'done'>('done');

  // Commission state
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [loadingComm, setLoadingComm] = useState(false);

  // Fee deductions
  const [feeDeductions, setFeeDeductions] = useState<FeeDeduction[]>([]);

  // Image (required)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Trip Modal
  const [activeTripDetails, setActiveTripDetails] = useState<any[] | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);

  useEffect(() => {
    const tzOffset = 7 * 60;
    const localTime = new Date(Date.now() + tzOffset * 60 * 1000);
    setSentAt(localTime.toISOString().substring(0, 16));
  }, []);

  // Load commission rates when kingdomId changes
  useEffect(() => {
    if (!supabase) return;
    loadCommissions();
  }, [kingdomId]);

  async function loadCommissions() {
    setLoadingComm(true);
    try {
      const kdInt = kingdomId ? parseInt(kingdomId) : null;
      const [commRes, adminRes] = await Promise.all([
        supabase.from('kingdom_commission_rates').select('*')
          .or(kdInt ? `kingdom_id.eq.${kdInt},kingdom_id.is.null` : 'kingdom_id.is.null'),
        supabase.from('profiles').select('id, name').eq('role', 'admin').order('name'),
      ]);

      const rates = commRes.data || [];
      const admins = adminRes.data || [];

      // Build rate map (kingdom overrides global)
      const rateMap: Record<string, number> = {};
      rates.filter((r: any) => r.kingdom_id === null).forEach((r: any) => { rateMap[r.user_id] = r.rate; });
      if (kdInt) {
        rates.filter((r: any) => r.kingdom_id === kdInt).forEach((r: any) => { rateMap[r.user_id] = r.rate; });
      }

      const entries: CommissionEntry[] = admins.map((a: any) => ({
        uid: a.id,
        name: a.name,
        rate: (rateMap[a.id] ?? '').toString(),
      }));
      setCommissions(entries);
    } finally {
      setLoadingComm(false);
    }
  }

  function updateCommissionRate(uid: string, val: string) {
    setCommissions(p => p.map(c => c.uid === uid ? { ...c, rate: val } : c));
  }

  // --- Fee deduction helpers ---
  function addFeeDeduction() {
    setFeeDeductions(p => [...p, { tempId: crypto.randomUUID(), label: '', amount: '' }]);
  }
  function updateFeeDeduction(tempId: string, field: keyof FeeDeduction, val: string) {
    setFeeDeductions(p => p.map(f => f.tempId === tempId ? { ...f, [field]: val } : f));
  }
  function removeFeeDeduction(tempId: string) {
    setFeeDeductions(p => p.filter(f => f.tempId !== tempId));
  }

  // Total resources in millions (net received)
  const totalResourceMil = useMemo(() => {
    if (!totals) return 0;
    return RESOURCES.reduce((s, res) => s + (totals[`${res}_received`] || 0), 0) / 1_000_000;
  }, [totals]);

  // All commissions rendered (including rate=0 so names don't disappear)
  // Only those with rate > 0 are used in calculations
  const commissionCalcs = useMemo(() =>
    commissions.map(c => ({
      ...c,
      amount: totalResourceMil * (parseNum(c.rate) || 0),
    })),
    [commissions, totalResourceMil]
  );

  const activeCommissions = useMemo(() =>
    commissionCalcs.filter(c => c.amount > 0),
    [commissionCalcs]
  );

  const totalCommission = useMemo(
    () => commissionCalcs.reduce((s, c) => s + c.amount, 0),
    [commissionCalcs]
  );

  const totalFees = useMemo(
    () => feeDeductions.reduce((s, f) => s + parseNum(f.amount), 0),
    [feeDeductions]
  );

  const feePerAdmin = useMemo(
    () => activeCommissions.length > 0 ? totalFees / activeCommissions.length : 0,
    [totalFees, activeCommissions]
  );

  const netCommissions = useMemo(() =>
    commissionCalcs.map(c => ({
      ...c,
      fee_share: feePerAdmin,
      net_amount: c.amount - feePerAdmin,
    })),
    [commissionCalcs, feePerAdmin]
  );

  const grandTotal = (totals?.estimated_value || 0) + totalCommission;

  // Empty states
  if (!totals || (totals.total_trips === 0 && warnings.length === 0)) {
    if (!hasAnyInput) {
      return (
        <div className="bg-white rounded-xl border border-[#E8DDC9] shadow-sm p-10 text-center animate-fadeIn">
          <Package className="w-10 h-10 text-[#6B8079]/30 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-[#0E3D40] mb-1">Belum Ada Input</h4>
          <p className="text-xs text-[#6B8079] max-w-xs mx-auto">
            Masukkan jumlah resource yang ingin diterima di panel kiri untuk melihat hasil kalkulasi.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-[#FAF5EA] rounded-xl border border-[#E8DDC9] shadow-sm p-10 text-center animate-fadeIn">
        <Info className="w-10 h-10 text-[#D9745A]/50 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-[#0E3D40] mb-1">Stok Akun Masih Kosong</h4>
        <p className="text-xs text-[#6B8079] max-w-xs mx-auto">
          Target sudah dimasukkan, tapi <strong>stok semua akun yang dipilih masih nol</strong>.
          Isi stok akun di halaman <span className="text-[#2BB673] font-semibold">Game Accounts</span> terlebih dahulu.
        </p>
      </div>
    );
  }

  async function handleSaveTransaction() {
    if (warnings.length > 0) return alert('Terdapat akun dengan input melebihi stok. Perbaiki dulu sebelum menyimpan.');
    if (!imageFile) return alert('Bukti transfer wajib diisi.');
    if (!toName) return alert('Nama penerima harus diisi.');
    if (!sentAt) return alert('Tanggal & waktu pengiriman harus diisi.');
    if (!confirm('Simpan transaksi ini?')) return;
    setSaving(true);

    try {
      // Upload image
      const ext = imageFile.name.split('.').pop();
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('transaction-images').upload(filePath, imageFile);
      if (uploadErr) throw new Error('Gagal upload gambar: ' + uploadErr.message);
      const { data: { publicUrl: imageUrl } } = supabase.storage.from('transaction-images').getPublicUrl(filePath);

      const activeKingdom = kingdoms?.find((k: any) => k.id === kingdomId);
      const kingdomName = activeKingdom ? activeKingdom.name : null;

      // Insert transaction
      const { data: tx, error: txErr } = await supabase.from('transactions').insert({
        created_by: userId,
        to_name: toName,
        notes: notes || null,
        sent_at: new Date(sentAt).toISOString(),
        kingdom: kingdomName,
        status,
        rate_food: prices?.food || 0,
        rate_wood: prices?.wood || 0,
        rate_stone: prices?.stone || 0,
        rate_gold: prices?.gold || 0,
        total_food_sent: totals.food_sent,
        total_wood_sent: totals.wood_sent,
        total_stone_sent: totals.stone_sent,
        total_gold_sent: totals.gold_sent,
        total_food_received: totals.food_received,
        total_wood_received: totals.wood_received,
        total_stone_received: totals.stone_received,
        total_gold_received: totals.gold_received,
        total_estimated_value: grandTotal,
        image_url: imageUrl,
      }).select('id').single();
      if (txErr || !tx) throw new Error(txErr?.message || 'Gagal membuat transaksi');

      // Group accountsData by owner (user_id)
      const ownerMap = new Map<string, { food: number; wood: number; stone: number; gold: number }>();
      for (const accData of accountsData as AccountCalcData[]) {
        const uid = (accData.account as any).user_id;
        if (!uid) continue;
        if (!ownerMap.has(uid)) ownerMap.set(uid, { food: 0, wood: 0, stone: 0, gold: 0 });
        const entry = ownerMap.get(uid)!;
        RESOURCES.forEach(res => {
          entry[res] += accData.resources[res].required_net;
        });
      }

      // Insert contributions per owner
      const contribRows = Array.from(ownerMap.entries()).map(([uid, res]) => ({
        transaction_id: tx.id,
        user_id: uid,
        food_received: res.food,
        wood_received: res.wood,
        stone_received: res.stone,
        gold_received: res.gold,
      }));
      if (contribRows.length > 0) {
        const { error: cErr } = await supabase.from('transaction_contributions').insert(contribRows);
        if (cErr) throw new Error(cErr.message);
      }

      // Insert commissions
      const validComms = commissionCalcs.filter(c => c.amount > 0);
      if (validComms.length > 0) {
        const commRows = validComms.map(c => ({
          transaction_id: tx.id,
          user_id: c.uid,
          rate: parseFloat(c.rate) || 0,
          amount: c.amount,
        }));
        const { error: commErr } = await supabase.from('transaction_commissions').insert(commRows);
        if (commErr) throw new Error(commErr.message);
      }

      // Insert fee deductions
      const validFees = feeDeductions.filter(f => f.label.trim() && parseNum(f.amount) > 0);
      if (validFees.length > 0) {
        const feeRows = validFees.map(f => ({
          transaction_id: tx.id,
          label: f.label.trim(),
          amount: parseNum(f.amount),
        }));
        const { error: feeErr } = await supabase.from('transaction_fee_deductions').insert(feeRows);
        if (feeErr) throw new Error(feeErr.message);
      }

      await log('transaction.create', { transaction_id: tx.id, to_name: toName, grand_total: grandTotal, kingdom: kingdomName }, userId);
      alert('Transaksi berhasil disimpan!');
      router.push('/transactions');
      router.refresh();
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* STOCK WARNINGS */}
      {warnings.length > 0 && (
        <div className="bg-[#D9745A]/10 border border-[#D9745A]/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D9745A] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-[#D9745A] mb-1.5">Input Melebihi Stok</h4>
              <ul className="space-y-1">
                {warnings.map((w: string, i: number) => (
                  <li key={i} className="text-xs text-[#D9745A]/90 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>{w}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-[#D9745A]/70 mt-2 font-medium">Transaksi tidak bisa disimpan selama ada pelanggaran stok di atas.</p>
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
                const tp = accData.tripPlan;
                const totalTrips = tp?.length || 0;

                function resTripInfo(res: string): string {
                  if (!tp) return '';
                  let count = 0;
                  let lastAmt = 0;
                  let isPartial = false;
                  for (let i = tp.length - 1; i >= 0; i--) {
                    const r = tp[i].resources[res];
                    if (!r) continue;
                    count++;
                    if (count === 1) {
                      lastAmt = r.net;
                      isPartial = r.net < accData.capacity_per_trip || Object.keys(tp[i].resources).length > 1;
                    }
                  }
                  if (count === 0) return '';
                  if (isPartial) return `${count}× (last ${fmt(lastAmt)})`;
                  return `${count}×`;
                }

                return (
                  <tr key={accData.account.id} className="hover:bg-[#FAF5EA]/20 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#0E3D40] text-xs">{accData.account.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                        <span className="px-1 py-0.1 rounded text-[8px] font-bold uppercase tracking-wider bg-[#0E3D40]/10 text-[#0E3D40]">{accData.account.type}</span>
                        <span className="text-[#6B8079] font-medium">{(accData.account as any).profile?.name || 'N/A'}</span>
                        <span className="text-[#E8DDC9]">|</span>
                        <span className="text-[#D9745A] font-bold">Pajak: {Math.round(accData.tax_rate * 100)}%</span>
                      </div>
                    </td>
                    {RESOURCES.map(res => {
                      const r = accData.resources[res];
                      if (r.required_gross <= 0) return <td key={res} className="py-2.5 px-3 text-right text-[#6B8079]/30">-</td>;
                      return (
                        <td key={res} className="py-2.5 px-3 text-right whitespace-nowrap font-medium font-mono">
                          <span className="text-[#2BB673] font-bold block">+{fmt(r.required_net)}</span>
                          <span className="text-[9px] text-[#6B8079]/75 block">Gross: {fmt(r.required_gross)}</span>
                          <span className="text-[8px] text-[#0E3D40]/60 block mt-0.5">{resTripInfo(res)}</span>
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center">
                      <div className="font-bold text-[#0E3D40]">{totalTrips} trip</div>
                      {totalTrips > 0 && (
                        <button type="button" onClick={() => {
                          setActiveTripDetails(tp || null);
                          setShowTripModal(true);
                        }} className="mt-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-[#E8DDC9] hover:bg-[#FAF5EA] text-[#0E3D40] font-bold text-[9px] transition-colors cursor-pointer">
                          Detail
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SAVE FORM */}
      {totals.total_trips > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">

          {/* Kiri: Ringkasan + Komisi */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white p-5 rounded-xl border border-[#E8DDC9] shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/60 pb-2">Ringkasan</h3>
              <div className="grid grid-cols-2 gap-3">
                {RESOURCES.map(res => (
                  <div key={res} className="p-3 bg-[#FAF5EA]/50 rounded-lg border border-[#E8DDC9]/50">
                    <span className="text-[10px] font-bold text-[#6B8079] uppercase tracking-wider block mb-1">{RESOURCE_LABELS[res]} Bersih</span>
                    <div className={cn('font-bold text-sm font-mono', {
                      'text-emerald-800': res === 'food', 'text-amber-800': res === 'wood',
                      'text-slate-800': res === 'stone', 'text-yellow-800': res === 'gold'
                    })}>
                      {fmt(totals[`${res}_received`] || 0)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-[#0E3D40] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Nilai Resource</span>
                  <span className="font-mono font-bold text-white">Rp {fmt(totals.estimated_value)}</span>
                </div>
                {totalCommission > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Komisi Pengurus</span>
                    <span className="font-mono font-bold text-[#2BB673]">+ Rp {fmt(totalCommission)}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-[10px] text-white/50 uppercase tracking-wider font-bold">Grand Total</span>
                  <span className="font-mono font-black text-white text-lg">Rp {fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Komisi */}
            <div className="bg-white rounded-xl border border-[#E8DDC9] shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#FAF5EA] border-b border-[#E8DDC9]">
                <Coins className="w-3.5 h-3.5 text-[#D9745A]" />
                <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider">Komisi Pengurus</h3>
                <span className="text-[9px] text-[#6B8079]">{fmt(totalResourceMil)}M × rate</span>
              </div>
              {loadingComm ? (
                <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-[#6B8079]" /></div>
              ) : commissions.length === 0 ? (
                <p className="text-xs text-center text-[#6B8079] p-4">Tidak ada komisi terdaftar untuk kingdom ini.</p>
              ) : (
                <div className="divide-y divide-[#E8DDC9]/50">
                  {commissionCalcs.map(c => (
                    <div key={c.uid} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-[#0E3D40]/10 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-black text-[#0E3D40]">{c.name.charAt(0)}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#0E3D40] flex-1">{c.name}</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={c.rate} onChange={e => updateCommissionRate(c.uid, e.target.value)}
                          className="w-14 text-right text-xs font-mono py-1 px-2 border border-[#E8DDC9] rounded focus:border-[#2BB673] outline-none bg-[#FAF5EA]/50" placeholder="0" />
                        <span className="text-[9px] text-[#6B8079]">/M</span>
                      </div>
                      <span className={`text-xs font-mono font-bold w-20 text-right ${c.amount > 0 ? 'text-[#D9745A]' : 'text-[#6B8079]/30'}`}>
                        {c.amount > 0 ? `Rp ${fmt(c.amount)}` : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Potongan Biaya */}
            <div className="bg-white rounded-xl border border-[#E8DDC9] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#D9745A]/10 border-b border-[#D9745A]/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#D9745A] uppercase tracking-wider">Potongan Biaya</span>
                  <span className="text-[9px] text-[#6B8079]">dibagi rata ke {activeCommissions.length} pengurus</span>
                </div>
                <button onClick={addFeeDeduction}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#D9745A] bg-[#D9745A]/10 hover:bg-[#D9745A]/20 px-2 py-1 rounded-lg transition-colors">
                  <Plus className="w-3 h-3" /> Tambah
                </button>
              </div>
              {feeDeductions.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-[#6B8079]">
                  Belum ada potongan biaya. (Opsional)
                </div>
              ) : (
                <div className="divide-y divide-[#E8DDC9]/50">
                  {feeDeductions.map(f => (
                    <div key={f.tempId} className="flex items-center gap-2 px-4 py-2.5">
                      <input type="text" value={f.label}
                        onChange={e => updateFeeDeduction(f.tempId, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 text-xs border border-[#E8DDC9] rounded px-2 py-1 outline-none focus:border-[#D9745A]" />
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-[#6B8079]">Rp</span>
                        <input type="text" inputMode="numeric" value={formatInput(f.amount)}
                          onChange={e => updateFeeDeduction(f.tempId, 'amount', e.target.value.replace(/\D/g, ''))}
                          placeholder="0"
                          className="w-full text-right text-xs font-mono py-1.5 pl-7 pr-2 border border-[#E8DDC9] rounded focus:border-[#D9745A] outline-none" />
                      </div>
                      <button onClick={() => removeFeeDeduction(f.tempId)}
                        className="p-1 text-[#6B8079] hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {totalFees > 0 && (
                <div className="px-4 py-2 bg-[#FAF5EA] border-t border-[#E8DDC9] flex items-center justify-between">
                  <span className="text-[10px] text-[#6B8079] font-medium">Total Potongan</span>
                  <span className="font-mono font-bold text-[#D9745A] text-xs">Rp {fmt(totalFees)}</span>
                </div>
              )}
            </div>

            {/* Ringkasan Bersih */}
            {netCommissions.length > 0 && totalFees > 0 && (
              <div className="bg-white rounded-xl border border-[#E8DDC9] shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#0E3D40]">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Bersih per Pengurus</h3>
                </div>
                <div className="divide-y divide-[#E8DDC9]/50">
                  {netCommissions.map(c => (
                    <div key={c.uid} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-semibold text-[#0E3D40]">{c.name}</span>
                      <div className="text-right">
                        <div className="text-[10px] text-[#6B8079]">Rp {fmt(c.amount)} - Rp {fmt(c.fee_share)}</div>
                        <div className="text-xs font-bold text-[#0E3D40] font-mono">Rp {fmt(c.net_amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Kanan: Form Catat */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-[#E8DDC9] shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/60 pb-2">Catat Transaksi</h3>

              <div>
                <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Status</label>
                <div className="flex gap-2">
                  {([['pending', '⏳ Pending', 'bg-amber-50 border-amber-400 text-amber-700'], ['done', '✅ Selesai', 'bg-emerald-50 border-emerald-400 text-emerald-700']] as const).map(([val, label, cls]) => (
                    <button key={val} type="button"
                      onClick={() => setStatus(val)}
                      className={`flex-1 text-xs font-bold py-2 px-3 rounded-lg border-2 transition-all ${
                        status === val ? cls : 'border-[#E8DDC9] text-[#6B8079] bg-white hover:border-[#C4B998]'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Nama Penerima</label>
                <input type="text" required value={toName} onChange={e => setToName(e.target.value)}
                  placeholder="Nama in-game buyer..."
                  className="w-full rounded-lg border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Tanggal & Waktu</label>
                <input type="datetime-local" required value={sentAt} onChange={e => setSentAt(e.target.value)}
                  className="w-full rounded-lg border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">Catatan (Opsional)</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-lg border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-2 px-3 font-semibold outline-none" />
              </div>

              {/* Image — REQUIRED */}
              <div>
                <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  Bukti Transfer <span className="text-red-500 normal-case">* Wajib</span>
                </label>
                {imagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview"
                      className="rounded-xl border border-[#E8DDC9] object-cover w-full max-h-[160px]" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 p-1 bg-[#D9745A] text-white rounded-full hover:bg-[#c0654d] transition-colors shadow">
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8DDC9] rounded-xl p-6 cursor-pointer hover:border-[#2BB673] hover:bg-[#2BB673]/5 transition-all group">
                    <Upload className="w-6 h-6 text-[#6B8079] mb-1.5 group-hover:text-[#2BB673] transition-colors" />
                    <span className="text-xs font-semibold text-[#6B8079] group-hover:text-[#2BB673] transition-colors">Klik untuk upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                    }} />
                  </label>
                )}
              </div>

              <button onClick={handleSaveTransaction}
                disabled={saving || !toName || !imageFile || warnings.length > 0}
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-[#2BB673] hover:bg-[#23945d] text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer">
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-white" /> Menyimpan...</>
                ) : warnings.length > 0 ? (
                  <><AlertTriangle className="w-4 h-4" /> Stok Tidak Mencukupi</>
                ) : !imageFile ? (
                  <><Upload className="w-4 h-4" /> Upload Bukti Transfer dulu</>
                ) : (
                  'Catat Transaksi'
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
              <button type="button" onClick={() => setShowTripModal(false)}
                className="text-[#6B8079] hover:text-[#0E3D40] transition-colors cursor-pointer">
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
                      <span className="inline-block bg-[#0E3D40] text-white font-bold text-[9px] px-2 py-0.5 rounded-full">Trip #{trip.trip}</span>
                      <div className="space-y-1">
                        {Object.entries(trip.resources).map(([resName, resVal]: any) => (
                          <div key={resName} className="flex items-center justify-between text-xs">
                            <span className="capitalize font-semibold text-[#6B8079] flex items-center gap-1">
                              <span className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[resName as ResourceType])}></span>
                              {resName}
                            </span>
                            <div className="text-right">
                          <span className="font-bold text-[#0E3D40] font-mono">{fmt(resVal.gross)}</span>
                          <span className="text-[9px] text-[#6B8079]/70 font-mono block">Net: {fmt(resVal.net)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center text-[#6B8079] italic py-4">Tidak ada detail trip.</p>
              )}
            </div>
            <div className="p-4 border-t border-[#E8DDC9] flex justify-end">
              <button type="button" onClick={() => setShowTripModal(false)}
                className="px-4 py-2 bg-[#0E3D40] hover:bg-[#1a5559] text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
