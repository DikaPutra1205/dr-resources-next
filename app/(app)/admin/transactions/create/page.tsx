'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X, Upload, Plus, Trash2, Users, TrendingUp, Loader2, Coins } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { fmt, RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn } from '@/lib/utils';

type ResourceKey = 'food' | 'wood' | 'stone' | 'gold';
const RES: ResourceKey[] = ['food', 'wood', 'stone', 'gold'];

interface Contributor {
  uid: string;
  tempId: string;
  food: string;
  wood: string;
  stone: string;
  gold: string;
}

interface CommissionEntry {
  uid: string;
  name: string;
  rate: string; // Rp per juta (editable)
}

function parseNum(val: string): number {
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export default function ManualTransactionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [kingdoms, setKingdoms] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);

  // Transaction fields
  const [kingdomId, setKingdomId] = useState<string>('');
  const [toName, setToName] = useState('');
  const [notes, setNotes] = useState('');
  const [sentAt, setSentAt] = useState(() => {
    const tzOffset = 7 * 60;
    return new Date(Date.now() + tzOffset * 60 * 1000).toISOString().substring(0, 16);
  });

  // Rates (Rp/juta per resource)
  const [rates, setRates] = useState<Record<ResourceKey, string>>({ food: '', wood: '', stone: '', gold: '' });

  // Contributors (per pemilik)
  const [contributors, setContributors] = useState<Contributor[]>([]);

  // Commissions (per admin, with rate)
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);

  // Image (required)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => { fetchBaseData(); }, []);

  async function fetchBaseData() {
    setLoading(true);
    const [kRes, pRes, aRes] = await Promise.all([
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('profiles').select('id, name, role').order('name'),
      supabase.from('profiles').select('id, name').eq('role', 'admin').order('name'),
    ]);
    setKingdoms(kRes.data || []);
    setProfiles(pRes.data || []);
    setAdmins(aRes.data || []);
    setLoading(false);
  }

  async function loadKingdomDefaults(kId: string) {
    const kdInt = kId ? parseInt(kId) : null;

    // Load resource prices
    const { data: prices } = await supabase
      .from('resource_prices')
      .select('*')
      .or(kdInt ? `kingdom_id.eq.${kdInt},kingdom_id.is.null` : 'kingdom_id.is.null');

    const rateMap: Record<ResourceKey, string> = { food: '', wood: '', stone: '', gold: '' };
    // First fill global defaults
    (prices || []).filter((p: any) => p.kingdom_id === null)
      .forEach((p: any) => { rateMap[p.resource as ResourceKey] = p.price_per_million.toString(); });
    // Then override with kingdom-specific
    if (kdInt) {
      (prices || []).filter((p: any) => p.kingdom_id === kdInt)
        .forEach((p: any) => { rateMap[p.resource as ResourceKey] = p.price_per_million.toString(); });
    }
    setRates(rateMap);

    // Load commission rates
    const { data: commRates } = await supabase
      .from('kingdom_commission_rates')
      .select('*')
      .or(kdInt ? `kingdom_id.eq.${kdInt},kingdom_id.is.null` : 'kingdom_id.is.null');

    // Build per-admin rate map (kingdom overrides global)
    const commMap: Record<string, number> = {};
    (commRates || []).filter((r: any) => r.kingdom_id === null)
      .forEach((r: any) => { commMap[r.user_id] = r.rate; });
    if (kdInt) {
      (commRates || []).filter((r: any) => r.kingdom_id === kdInt)
        .forEach((r: any) => { commMap[r.user_id] = r.rate; });
    }

    // Build commissions list for all admins that have a rate
    const { data: adminList } = await supabase.from('profiles').select('id, name').eq('role', 'admin').order('name');
    const entries: CommissionEntry[] = (adminList || []).map((a: any) => ({
      uid: a.id,
      name: a.name,
      rate: (commMap[a.id] ?? '').toString(),
    }));
    setCommissions(entries);
  }

  function handleKingdomChange(val: string) {
    setKingdomId(val);
    loadKingdomDefaults(val);
  }

  // --- Contributor helpers ---
  function addContributor() {
    setContributors(p => [...p, { uid: '', tempId: crypto.randomUUID(), food: '', wood: '', stone: '', gold: '' }]);
  }
  function updateContributor(tempId: string, field: keyof Contributor, val: string) {
    setContributors(p => p.map(c => c.tempId === tempId ? { ...c, [field]: val } : c));
  }
  function removeContributor(tempId: string) {
    setContributors(p => p.filter(c => c.tempId !== tempId));
  }

  // --- Commission helpers ---
  function updateCommissionRate(uid: string, val: string) {
    setCommissions(p => p.map(c => c.uid === uid ? { ...c, rate: val } : c));
  }

  // --- Derived values ---
  const rateNum = useMemo(() => ({
    food: parseNum(rates.food),
    wood: parseNum(rates.wood),
    stone: parseNum(rates.stone),
    gold: parseNum(rates.gold),
  }), [rates]);

  function contribValue(c: Contributor): number {
    return RES.reduce((sum, r) => sum + parseNum(c[r]) * rateNum[r], 0);
  }

  // Total resources in millions across all contributors
  const totalResourceMil = useMemo(() =>
    contributors.reduce((sum, c) => sum + RES.reduce((s, r) => s + parseNum(c[r]), 0), 0),
    [contributors]
  );

  const totalContribValue = useMemo(
    () => contributors.reduce((s, c) => s + contribValue(c), 0),
    [contributors, rateNum]
  );

  const commissionCalcs = useMemo(() =>
    commissions.map(c => ({
      ...c,
      amount: totalResourceMil * parseNum(c.rate),
    })),
    [commissions, totalResourceMil]
  );

  const totalCommission = useMemo(
    () => commissionCalcs.reduce((s, c) => s + c.amount, 0),
    [commissionCalcs]
  );

  const grandTotal = totalContribValue + totalCommission;

  const resTotals = useMemo(() => {
    const t = { food: 0, wood: 0, stone: 0, gold: 0 };
    contributors.forEach(c => RES.forEach(r => { t[r] += parseNum(c[r]); }));
    return t;
  }, [contributors]);

  // --- Upload ---
  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;
    const ext = imageFile.name.split('.').pop();
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('transaction-images').upload(filePath, imageFile);
    if (error) throw new Error('Gagal upload gambar: ' + error.message);
    const { data: { publicUrl } } = supabase.storage.from('transaction-images').getPublicUrl(filePath);
    return publicUrl;
  }

  // --- Save ---
  async function handleSave() {
    if (!imageFile) return alert('Bukti transfer wajib diisi.');
    if (!toName.trim()) return alert('Nama buyer harus diisi.');
    const validContribs = contributors.filter(c => c.uid && RES.some(r => parseNum(c[r]) > 0));
    if (validContribs.length === 0) return alert('Tambahkan minimal satu kontributor dengan resource.');
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const imageUrl = await uploadImage();
      const kd = kingdoms.find(k => k.id.toString() === kingdomId);

      const totalReceived = { food: 0, wood: 0, stone: 0, gold: 0 };
      validContribs.forEach(c => RES.forEach(r => { totalReceived[r] += parseNum(c[r]) * 1_000_000; }));

      const { data: tx, error: txErr } = await supabase.from('transactions').insert({
        created_by: user.id,
        to_name: toName.trim(),
        notes: notes || null,
        sent_at: new Date(sentAt).toISOString(),
        kingdom: kd?.name || null,
        rate_food: rateNum.food,
        rate_wood: rateNum.wood,
        rate_stone: rateNum.stone,
        rate_gold: rateNum.gold,
        total_food_sent: 0, total_wood_sent: 0, total_stone_sent: 0, total_gold_sent: 0,
        total_food_received: totalReceived.food,
        total_wood_received: totalReceived.wood,
        total_stone_received: totalReceived.stone,
        total_gold_received: totalReceived.gold,
        total_estimated_value: grandTotal,
        image_url: imageUrl,
      }).select('id').single();
      if (txErr) throw txErr;

      // Insert contributions per pemilik
      const contribRows = validContribs.map(c => ({
        transaction_id: tx.id,
        user_id: c.uid,
        food_received: Math.round(parseNum(c.food) * 1_000_000),
        wood_received: Math.round(parseNum(c.wood) * 1_000_000),
        stone_received: Math.round(parseNum(c.stone) * 1_000_000),
        gold_received: Math.round(parseNum(c.gold) * 1_000_000),
      }));
      const { error: cErr } = await supabase.from('transaction_contributions').insert(contribRows);
      if (cErr) throw cErr;

      // Insert commissions
      const validComms = commissionCalcs.filter(c => c.amount > 0);
      if (validComms.length > 0) {
        const commRows = validComms.map(c => ({
          transaction_id: tx.id,
          user_id: c.uid,
          rate: parseNum(c.rate),
          amount: c.amount,
        }));
        const { error: commErr } = await supabase.from('transaction_commissions').insert(commRows);
        if (commErr) throw commErr;
      }

      router.push('/transactions');
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
      setSaving(false);
    }
  }

  const usedContribUids = contributors.map(c => c.uid).filter(Boolean);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/transactions" className="p-2 bg-white border border-[#E8DDC9] text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Catat Transaksi</h1>
            <p className="text-sm text-[#6B8079] mt-0.5">Input manual kontribusi per pemilik + komisi pengurus</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="btn-primary px-6 shadow-lg shadow-[#2BB673]/20 flex items-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4" /> Simpan</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== LEFT PANEL ===== */}
        <div className="lg:col-span-2 space-y-4">

          {/* Detail */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9] pb-2.5">
              Detail Pengiriman
            </h3>
            <div>
              <label className="label">Kingdom</label>
              <select
                value={kingdomId}
                onChange={e => handleKingdomChange(e.target.value)}
                className="input"
              >
                <option value="">-- Pilih Kingdom --</option>
                {kingdoms.map(k => (
                  <option key={k.id} value={k.id.toString()}>{k.name}</option>
                ))}
              </select>
              {kingdomId && (
                <p className="text-[10px] text-[#2BB673] mt-1 font-medium">✓ Rate & komisi dimuat dari kingdom</p>
              )}
            </div>
            <div>
              <label className="label">Buyer (Penerima)</label>
              <input type="text" value={toName} onChange={e => setToName(e.target.value)}
                className="input" placeholder="Nama in-game buyer..." />
            </div>
            <div>
              <label className="label">Tanggal Pengiriman</label>
              <input type="datetime-local" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Catatan (opsional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="input min-h-[60px] resize-none" placeholder="Catatan tambahan..." />
            </div>
          </div>

          {/* Rate (editable, auto-loaded dari kingdom) */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9] pb-2.5 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#2BB673]" /> Rate (Rp/juta)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {RES.map(res => (
                <div key={res}>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res])} />
                    {RESOURCE_LABELS[res]}
                  </label>
                  <input type="number" value={rates[res]}
                    onChange={e => setRates(p => ({ ...p, [res]: e.target.value }))}
                    className="input font-mono" placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          {/* Bukti Transfer — WAJIB */}
          <div className="card p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9] pb-2.5 flex items-center justify-between">
              Bukti Transfer
              <span className="text-[10px] text-red-500 font-bold normal-case">* Wajib</span>
            </h3>
            {imagePreview ? (
              <div className="relative">
                <Image src={imagePreview} alt="Preview" width={400} height={300}
                  className="rounded-xl border border-[#E8DDC9] object-cover w-full max-h-[200px]" />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-[#D9745A] text-white rounded-full hover:bg-[#c0654d] transition-colors shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8DDC9] rounded-xl p-8 cursor-pointer hover:border-[#2BB673] hover:bg-[#2BB673]/5 transition-all group">
                <Upload className="w-7 h-7 text-[#6B8079] mb-2 group-hover:text-[#2BB673] transition-colors" />
                <span className="text-xs font-semibold text-[#6B8079] group-hover:text-[#2BB673] transition-colors">Klik untuk upload gambar</span>
                <span className="text-[10px] text-[#6B8079]/60 mt-1">PNG, JPG, WEBP</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                }} />
              </label>
            )}
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="lg:col-span-3 space-y-4">

          {/* Kontributor */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0E3D40]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-white/70" />
                <h3 className="text-sm font-bold text-white">Kontributor</h3>
                <span className="text-[10px] text-white/50">per pemilik</span>
              </div>
              <button onClick={addContributor}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>

            <div className="divide-y divide-[#E8DDC9]/50">
              {contributors.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-[#6B8079]">Belum ada kontributor.</div>
              )}
              {contributors.map((c, idx) => {
                const val = contribValue(c);
                const available = profiles.filter(p => !usedContribUids.includes(p.id) || p.id === c.uid);
                return (
                  <div key={c.tempId} className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-[#6B8079] w-5 shrink-0">#{idx + 1}</span>
                      <select value={c.uid} onChange={e => updateContributor(c.tempId, 'uid', e.target.value)}
                        className="flex-1 input py-2 text-sm">
                        <option value="">-- Pilih Pemilik --</option>
                        {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {val > 0 && (
                        <span className="text-xs font-mono font-bold text-[#2BB673] whitespace-nowrap">Rp {fmt(val)}</span>
                      )}
                      <button onClick={() => removeContributor(c.tempId)}
                        className="p-1.5 text-[#6B8079] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pl-8">
                      {RES.map(res => (
                        <div key={res}>
                          <label className="flex items-center gap-1 text-[9px] font-bold text-[#6B8079] uppercase mb-1">
                            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', RESOURCE_DOT[res])} />
                            {RESOURCE_LABELS[res]}
                          </label>
                          <div className="relative">
                            <input type="number" value={c[res]}
                              onChange={e => updateContributor(c.tempId, res, e.target.value)}
                              placeholder="0"
                              className="w-full input font-mono text-sm py-1.5 pr-6" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#6B8079]/60 pointer-events-none">M</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {contributors.length > 0 && (
              <div className="px-5 py-3 bg-[#FAF5EA] border-t border-[#E8DDC9] flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  {RES.map(res => resTotals[res] > 0 ? (
                    <div key={res} className="flex items-center gap-1">
                      <div className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res])} />
                      <span className="text-xs font-mono font-bold text-[#0E3D40]">{resTotals[res]}M</span>
                    </div>
                  ) : null)}
                  <span className="text-[10px] text-[#6B8079]">= {fmt(totalResourceMil)}M total</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#6B8079] font-medium uppercase tracking-wider">Total Kontribusi</div>
                  <div className="font-mono font-black text-[#0E3D40]">Rp {fmt(totalContribValue)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Komisi Pengurus */}
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 bg-[#FAF5EA] border-b border-[#E8DDC9]">
              <Coins className="w-4 h-4 text-[#D9745A]" />
              <h3 className="text-sm font-bold text-[#0E3D40]">Komisi Pengurus</h3>
              <span className="text-[10px] text-[#6B8079]">({fmt(totalResourceMil)}M × rate)</span>
            </div>

            {commissions.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-[#6B8079]">
                Pilih kingdom terlebih dahulu untuk memuat komisi default.
              </div>
            ) : (
              <div className="divide-y divide-[#E8DDC9]/50">
                {commissionCalcs.map(c => (
                  <div key={c.uid} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-full bg-[#0E3D40]/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-[#0E3D40]">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="font-semibold text-[#0E3D40] text-sm flex-1">{c.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#6B8079]">Rp</span>
                      <input type="number" value={c.rate}
                        onChange={e => updateCommissionRate(c.uid, e.target.value)}
                        className="w-16 input font-mono text-sm py-1.5 text-right"
                        placeholder="0"
                      />
                      <span className="text-[10px] text-[#6B8079]">/M</span>
                    </div>
                    <span className="font-mono font-bold text-[#D9745A] text-sm w-24 text-right">
                      {c.amount > 0 ? `Rp ${fmt(c.amount)}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {totalCommission > 0 && (
              <div className="px-5 py-3 bg-[#FAF5EA] border-t border-[#E8DDC9] flex items-center justify-end gap-3">
                <span className="text-[10px] text-[#6B8079] font-medium uppercase tracking-wider">Total Komisi</span>
                <span className="font-mono font-black text-[#D9745A]">Rp {fmt(totalCommission)}</span>
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="card p-5 bg-[#0E3D40]">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                {totalContribValue > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60">Kontribusi</span>
                    <span className="font-mono text-sm font-bold text-white">Rp {fmt(totalContribValue)}</span>
                  </div>
                )}
                {totalCommission > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60">Komisi</span>
                    <span className="font-mono text-sm font-bold text-[#2BB673]">+ Rp {fmt(totalCommission)}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-white/50 uppercase tracking-wider font-bold">Grand Total</div>
                <div className="font-mono text-2xl font-black text-white mt-0.5">Rp {fmt(grandTotal)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
