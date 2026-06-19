'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X, Upload, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { fmt, RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn } from '@/lib/utils';
import type { GameAccount, ResourcePrices } from '@/lib/types';

export default function ManualTransactionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [prices, setPrices] = useState<ResourcePrices>({ food: 0, wood: 0, stone: 0, gold: 0 });

  // Form State
  const [toName, setToName] = useState('');
  const [notes, setNotes] = useState('');
  const [sentAt, setSentAt] = useState(() => {
    const tzOffset = 7 * 60;
    return new Date(Date.now() + tzOffset * 60 * 1000).toISOString().substring(0, 16);
  });
  const [kingdom, setKingdom] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [inputs, setInputs] = useState<Record<number, Record<string, number>>>({});

  // Search & UI state
  const [search, setSearch] = useState('');
  const [collapsedKingdoms, setCollapsedKingdoms] = useState<Set<string>>(new Set());
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(new Set());

  // Image Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      supabase.from('game_accounts')
        .select('*, profile:profiles(id, name), kingdom:kingdoms(*)')
        .order('name'),
      supabase.from('resource_prices').select('*').is('kingdom_id', null)
    ]);

    setAccounts((aRes.data || []) as any[]);

    const ps = pRes.data || [];
    const pMap = { food: 0, wood: 0, stone: 0, gold: 0 };
    ps.forEach(p => pMap[p.resource as keyof typeof pMap] = p.price_per_million);
    setPrices(pMap);
    setLoading(false);
  }

  function handleInput(accId: number, res: string, val: string) {
    const num = parseInt(val.replace(/,/g, ''), 10) || 0;
    setInputs(prev => ({ ...prev, [accId]: { ...(prev[accId] || {}), [res]: Math.max(0, num) } }));
  }

  function toggleAccount(id: number) {
    if (selectedAccountIds.includes(id)) {
      setSelectedAccountIds(prev => prev.filter(x => x !== id));
      setInputs(prev => { const next = { ...prev }; delete next[id]; return next; });
    } else {
      setSelectedAccountIds(prev => [...prev, id]);
    }
  }

  function toggleKingdom(key: string) {
    setCollapsedKingdoms(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleOwner(key: string) {
    setCollapsedOwners(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return null;
    setUploading(true);
    try {
      const ext = imageFile.name.split('.').pop();
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('transaction-images').upload(filePath, imageFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('transaction-images').getPublicUrl(filePath);
      return publicUrl;
    } catch (err: any) {
      alert('Gagal upload gambar: ' + err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!toName) return alert('Nama tujuan harus diisi.');
    if (selectedAccountIds.length === 0) return alert('Pilih minimal satu akun.');
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const imageUrl = await uploadImage();

      let tFood = 0, tWood = 0, tStone = 0, tGold = 0, tVal = 0;
      const contributions = [];

      for (const accId of selectedAccountIds) {
        const inp = inputs[accId] || {};
        const f = inp.food || 0, w = inp.wood || 0, s = inp.stone || 0, g = inp.gold || 0;
        if (f + w + s + g === 0) continue;

        const val = ((f / 1_000_000) * prices.food) + ((w / 1_000_000) * prices.wood) +
                    ((s / 1_000_000) * prices.stone) + ((g / 1_000_000) * prices.gold);
        tFood += f; tWood += w; tStone += s; tGold += g; tVal += val;

        contributions.push({
          game_account_id: accId,
          food_received: f, wood_received: w, stone_received: s, gold_received: g,
          food_sent: 0, wood_sent: 0, stone_sent: 0, gold_sent: 0,
          tax_rate: 0, total_trips: 1, trip_details: []
        });
      }

      if (contributions.length === 0) {
        setSaving(false);
        return alert('Tidak ada resource yang diinput.');
      }

      const { data: tx, error: txError } = await supabase.from('transactions').insert({
        created_by: user.id, to_name: toName, notes: notes || null,
        sent_at: new Date(sentAt).toISOString(), kingdom: kingdom || null,
        total_food_sent: 0, total_wood_sent: 0, total_stone_sent: 0, total_gold_sent: 0,
        total_food_received: tFood, total_wood_received: tWood,
        total_stone_received: tStone, total_gold_received: tGold,
        total_estimated_value: tVal, image_url: imageUrl
      }).select('id').single();
      if (txError) throw txError;

      const { error: cError } = await supabase.from('transaction_contributions').insert(
        contributions.map(c => ({ ...c, transaction_id: tx.id }))
      );
      if (cError) throw cError;

      alert('Transaksi manual berhasil dicatat!');
      router.push('/transactions');
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
      setSaving(false);
    }
  }

  // Group accounts by kingdom → owner, filtered by search
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = accounts.filter(a =>
      !q ||
      a.name?.toLowerCase().includes(q) ||
      a.profile?.name?.toLowerCase().includes(q) ||
      a.kingdom?.name?.toLowerCase().includes(q)
    );

    const kingdomMap = new Map<string, { label: string; ownerMap: Map<string, { label: string; accounts: any[] }> }>();

    filtered.forEach(acc => {
      const kKey = acc.kingdom?.id ?? 'none';
      const kLabel = acc.kingdom?.name ?? 'Tanpa Kingdom';
      const oKey = acc.profile?.id ?? 'unknown';
      const oLabel = acc.profile?.name ?? 'N/A';

      if (!kingdomMap.has(kKey)) kingdomMap.set(kKey, { label: kLabel, ownerMap: new Map() });
      const km = kingdomMap.get(kKey)!;
      if (!km.ownerMap.has(oKey)) km.ownerMap.set(oKey, { label: oLabel, accounts: [] });
      km.ownerMap.get(oKey)!.accounts.push(acc);
    });

    return Array.from(kingdomMap.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [accounts, search]);

  if (loading) return <div className="p-8 text-center animate-pulse text-[#6B8079]">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/transactions" className="p-2 bg-white/50 border border-white/40 text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all backdrop-blur-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Manual Transaction</h1>
            <p className="text-sm text-[#6B8079] mt-1">Catat transaksi manual (Admin)</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-6 shadow-xl shadow-[#2BB673]/20">
          {saving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Transaksi</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Detail */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider border-b border-black/5 pb-2">Detail Pengiriman</h3>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Penerima (To)</label>
              <input type="text" value={toName} onChange={e => setToName(e.target.value)} className="input-field" placeholder="Nama in-game penerima..." />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Tanggal Pengiriman</label>
              <input type="datetime-local" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input-field" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Kingdom (Opsional)</label>
              <input type="text" value={kingdom} onChange={e => setKingdom(e.target.value)} className="input-field" placeholder="Contoh: 4101" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Catatan (Opsional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field min-h-[80px]" placeholder="Catatan transaksi..." />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Bukti Transfer (Opsional)</label>
              {imagePreview ? (
                <div className="relative">
                  <Image src={imagePreview} alt="Preview" width={400} height={300} className="rounded-lg border border-[#E8DDC9] object-cover w-full max-h-[200px]" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 p-1 bg-[#D9745A] text-white rounded-full hover:bg-[#c0654d] transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#E8DDC9] rounded-lg p-6 cursor-pointer hover:border-[#2BB673] hover:bg-[#2BB673]/5 transition-all">
                  <Upload className="w-6 h-6 text-[#6B8079] mb-2" />
                  <span className="text-xs font-semibold text-[#6B8079]">Klik untuk upload gambar</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
                  }} />
                </label>
              )}
            </div>
          </div>

          {/* Summary */}
          {selectedAccountIds.length > 0 && (
            <div className="glass-card p-4 space-y-2">
              <h4 className="text-xs font-bold text-[#0E3D40] uppercase tracking-wider">{selectedAccountIds.length} Akun Dipilih</h4>
              {RESOURCES.map(res => {
                const total = selectedAccountIds.reduce((sum, id) => sum + (inputs[id]?.[res] || 0), 0);
                return total > 0 ? (
                  <div key={res} className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-[#6B8079] font-medium">
                      <div className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[res])} />
                      {RESOURCE_LABELS[res]}
                    </span>
                    <span className="font-mono font-bold text-[#0E3D40]">{fmt(total)}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Account Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-3">
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Pilih Akun Game</h3>
              <span className="text-xs font-bold bg-[#0E3D40]/10 text-[#0E3D40] px-2 py-1 rounded-md">
                {selectedAccountIds.length} Dipilih
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B8079]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama akun, pemilik, atau kingdom..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-[#FAF5EA]/60 border border-[#E8DDC9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2BB673]/30 focus:border-[#2BB673] text-[#0E3D40] placeholder:text-[#6B8079]/60"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B8079] hover:text-[#0E3D40]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Grouped List */}
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {grouped.length === 0 && (
                <p className="text-center text-sm text-[#6B8079] py-8">Tidak ada akun ditemukan.</p>
              )}
              {grouped.map(([kKey, { label: kLabel, ownerMap }]) => {
                const isKCollapsed = collapsedKingdoms.has(kKey);
                return (
                  <div key={kKey} className="border border-[#E8DDC9] rounded-xl overflow-hidden">
                    {/* Kingdom Header */}
                    <button
                      type="button"
                      onClick={() => toggleKingdom(kKey)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#0E3D40] text-white hover:bg-[#0E3D40]/90 transition-colors"
                    >
                      <span className="text-sm font-bold tracking-wide">
                        Kingdom {kLabel}
                        <span className="ml-2 text-[10px] font-normal opacity-60">
                          {Array.from(ownerMap.values()).reduce((s, o) => s + o.accounts.length, 0)} akun · {ownerMap.size} pemilik
                        </span>
                      </span>
                      {isKCollapsed ? <ChevronRight className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
                    </button>

                    {!isKCollapsed && (
                      <div className="divide-y divide-[#E8DDC9]/50">
                        {Array.from(ownerMap.entries()).map(([oKey, { label: oLabel, accounts: ownerAccs }]) => {
                          const ownerKey = `${kKey}-${oKey}`;
                          const isOCollapsed = collapsedOwners.has(ownerKey);
                          const ownerSelected = ownerAccs.filter(a => selectedAccountIds.includes(a.id)).length;
                          return (
                            <div key={oKey}>
                              {/* Owner Header */}
                              <button
                                type="button"
                                onClick={() => toggleOwner(ownerKey)}
                                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#FAF5EA] hover:bg-[#FAF5EA]/80 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#2BB673]/15 flex items-center justify-center">
                                    <span className="text-[9px] font-black text-[#2BB673]">{oLabel.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <span className="text-xs font-bold text-[#0E3D40]">{oLabel}</span>
                                  <span className="text-[10px] text-[#6B8079]">{ownerAccs.length} akun</span>
                                  {ownerSelected > 0 && (
                                    <span className="text-[10px] font-bold bg-[#2BB673]/15 text-[#2BB673] px-1.5 py-0.5 rounded-full">
                                      {ownerSelected} dipilih
                                    </span>
                                  )}
                                </div>
                                {isOCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-[#6B8079]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#6B8079]" />}
                              </button>

                              {/* Account List */}
                              {!isOCollapsed && (
                                <div className="divide-y divide-[#E8DDC9]/30">
                                  {ownerAccs.map(acc => {
                                    const isSelected = selectedAccountIds.includes(acc.id);
                                    return (
                                      <div key={acc.id} className={cn(
                                        "px-4 py-3 transition-all",
                                        isSelected ? "bg-[#2BB673]/5" : "bg-white hover:bg-[#FAF5EA]/40"
                                      )}>
                                        {/* Account Row */}
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleAccount(acc.id)}>
                                          <div className={cn(
                                            "w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0",
                                            isSelected ? "bg-[#2BB673] border-[#2BB673] text-white" : "border-[#C1CCC8] bg-white"
                                          )}>
                                            {isSelected && <Check className="w-3 h-3" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[#0E3D40] text-sm flex items-center gap-2 flex-wrap">
                                              {acc.name}
                                              <span className={cn("text-[9px] px-1 py-0.5 rounded uppercase tracking-wider border",
                                                acc.type === 'main' ? "bg-[#0E3D40]/5 border-[#0E3D40]/20 text-[#0E3D40]" : "bg-[#6B8079]/5 border-[#6B8079]/20 text-[#6B8079]"
                                              )}>{acc.type}</span>
                                            </div>
                                            <div className="text-[10px] text-[#6B8079]">TP {acc.trading_post_level} · SH {acc.storehouse_level}</div>
                                          </div>
                                        </div>

                                        {/* Resource Inputs */}
                                        {isSelected && (
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-[#E8DDC9]/50 animate-fadeIn">
                                            {RESOURCES.map(res => (
                                              <div key={res}>
                                                <label className="flex items-center gap-1 text-[9px] font-bold text-[#6B8079] uppercase tracking-wider mb-1">
                                                  <div className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[res])} />
                                                  {RESOURCE_LABELS[res]}
                                                </label>
                                                <input
                                                  type="text"
                                                  value={inputs[acc.id]?.[res] ? fmt(inputs[acc.id][res]) : ''}
                                                  onChange={e => handleInput(acc.id, res, e.target.value)}
                                                  placeholder="0"
                                                  className="w-full bg-[#FAF5EA]/50 border border-[#E8DDC9] rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2BB673]/50 focus:border-[#2BB673]"
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
