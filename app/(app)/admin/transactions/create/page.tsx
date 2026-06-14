'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, ShieldAlert, Check } from 'lucide-react';
import Link from 'next/link';
import { fmt, RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn } from '@/lib/utils';
import type { GameAccount, ResourcePrices } from '@/lib/types';

export default function ManualTransactionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [prices, setPrices] = useState<ResourcePrices>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [kingdoms, setKingdoms] = useState<string[]>([]);

  // Form State
  const [toName, setToName] = useState('');
  const [notes, setNotes] = useState('');
  const [sentAt, setSentAt] = useState(new Date().toISOString().slice(0, 16));
  const [kingdom, setKingdom] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  
  // input net: { accId: { food: number, wood: number, ... } }
  const [inputs, setInputs] = useState<Record<number, Record<string, number>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      supabase.from('game_accounts').select('*, profile:profiles(name), kingdom:kingdoms(*)').order('name'),
      supabase.from('resource_prices').select('*').is('kingdom_id', null)
    ]);

    const accs = (aRes.data || []) as any[];
    setAccounts(accs);

    // unique kingdoms
    const kList = accs.map(a => a.kingdom?.name || a.kingdom).filter(Boolean);
    setKingdoms(Array.from(new Set(kList)));

    // map global prices
    const ps = pRes.data || [];
    const pMap = { food: 0, wood: 0, stone: 0, gold: 0 };
    ps.forEach(p => pMap[p.resource as keyof typeof pMap] = p.price_per_million);
    setPrices(pMap);
    
    setLoading(false);
  }

  function handleInput(accId: number, res: string, val: string) {
    const num = parseInt(val.replace(/,/g, ''), 10) || 0;
    setInputs(prev => ({
      ...prev,
      [accId]: { ...(prev[accId] || {}), [res]: Math.max(0, num) }
    }));
  }

  function toggleAccount(id: number) {
    if (selectedAccountIds.includes(id)) {
      setSelectedAccountIds(prev => prev.filter(x => x !== id));
      setInputs(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelectedAccountIds(prev => [...prev, id]);
    }
  }

  async function handleSave() {
    if (!toName) return alert('Nama tujuan (to_name) harus diisi.');
    if (selectedAccountIds.length === 0) return alert('Pilih minimal satu akun.');

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // Calculate totals
      let tFood = 0, tWood = 0, tStone = 0, tGold = 0, tVal = 0;
      const contributions = [];

      for (const accId of selectedAccountIds) {
        const inp = inputs[accId] || {};
        const f = inp.food || 0;
        const w = inp.wood || 0;
        const s = inp.stone || 0;
        const g = inp.gold || 0;

        if (f + w + s + g === 0) continue;

        const val = ((f / 1_000_000) * prices.food) +
                    ((w / 1_000_000) * prices.wood) +
                    ((s / 1_000_000) * prices.stone) +
                    ((g / 1_000_000) * prices.gold);

        tFood += f; tWood += w; tStone += s; tGold += g;
        tVal += val;

        contributions.push({
          game_account_id: accId,
          food_received: f, wood_received: w, stone_received: s, gold_received: g,
          food_sent: 0, wood_sent: 0, stone_sent: 0, gold_sent: 0,
          tax_rate: 0, total_trips: 1, trip_details: []
        });
      }

      if (contributions.length === 0) {
        setSaving(false);
        return alert('Tidak ada resource yang diinput. Masukkan nilai > 0.');
      }

      // Insert transaction header
      const txPayload = {
        created_by: user.id,
        to_name: toName,
        notes: notes || null,
        sent_at: new Date(sentAt).toISOString(),
        kingdom: kingdom || null,
        total_food_sent: 0, total_wood_sent: 0, total_stone_sent: 0, total_gold_sent: 0,
        total_food_received: tFood, total_wood_received: tWood, total_stone_received: tStone, total_gold_received: tGold,
        total_estimated_value: tVal
      };

      const { data: tx, error: txError } = await supabase.from('transactions').insert(txPayload).select('id').single();
      if (txError) throw txError;

      // Insert contributions
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

  if (loading) return <div className="p-8 text-center animate-pulse text-[#6B8079]">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/transactions" className="p-2 bg-white/50 border border-white/40 text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all backdrop-blur-md">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Manual Transaction</h1>
            <p className="text-sm text-[#6B8079] mt-1">Catat transaksi manual tanpa potong stok (Admin)</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 shadow-xl shadow-[#2BB673]/20"
        >
          {saving ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Transaksi</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Header */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider border-b border-black/5 pb-2">Detail Pengiriman</h3>
            
            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Penerima (To)</label>
              <input type="text" value={toName} onChange={e => setToName(e.target.value)} className="input-field" placeholder="Nama in-game penerima..." />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Tanggal Pengiriman (Sent At)</label>
              <input type="datetime-local" value={sentAt} onChange={e => setSentAt(e.target.value)} className="input-field" />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Kingdom (Opsional)</label>
              <input type="text" value={kingdom} onChange={e => setKingdom(e.target.value)} list="klist" className="input-field" placeholder="Contoh: 3324" />
              <datalist id="klist">
                {kingdoms.map(k => <option key={k} value={k} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#6B8079] mb-1.5">Catatan (Opsional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field min-h-[80px]" placeholder="Catatan transaksi..." />
            </div>
          </div>
          
          <div className="p-4 rounded-2xl bg-[#D9745A]/10 border border-[#D9745A]/20 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#D9745A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#D9745A] font-medium leading-relaxed">
              <strong>Penting:</strong> Mode Manual ini <span className="underline">TIDAK</span> akan memotong stok otomatis dari akun. Gunakan ini hanya untuk mencatat transaksi lampau atau sinkronisasi data manual.
            </p>
          </div>
        </div>

        {/* Account Selection & Input */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-3">
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Input Resource Bersih (Net)</h3>
              <span className="text-xs font-bold bg-[#0E3D40]/10 text-[#0E3D40] px-2 py-1 rounded-md">
                {selectedAccountIds.length} Akun Dipilih
              </span>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {accounts.map(acc => {
                const isSelected = selectedAccountIds.includes(acc.id);
                return (
                  <div key={acc.id} className={cn(
                    "border rounded-xl p-4 transition-all duration-300",
                    isSelected ? "bg-white border-[#2BB673]/30 shadow-md shadow-[#2BB673]/5 ring-1 ring-[#2BB673]/20" : "bg-white/50 border-black/5 hover:border-black/10 cursor-pointer"
                  )}>
                    <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => toggleAccount(acc.id)}>
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center border transition-colors",
                        isSelected ? "bg-[#2BB673] border-[#2BB673] text-white" : "border-[#C1CCC8] bg-white"
                      )}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-[#0E3D40] text-sm flex items-center gap-2">
                          {acc.name}
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider", acc.type === 'main' ? "bg-[#0E3D40]/5 border-[#0E3D40]/20 text-[#0E3D40]" : "bg-[#6B8079]/5 border-[#6B8079]/20 text-[#6B8079]")}>
                            {acc.type}
                          </span>
                        </div>
                        <div className="text-xs text-[#6B8079]">Milik: {acc.profile?.name}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-black/5 mt-2 animate-fadeIn">
                        {RESOURCES.map(res => (
                          <div key={res}>
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#6B8079] uppercase tracking-wider mb-1.5">
                              <div className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[res])}></div>
                              {RESOURCE_LABELS[res]}
                            </label>
                            <input
                              type="text"
                              value={inputs[acc.id]?.[res] ? fmt(inputs[acc.id][res]) : ''}
                              onChange={(e) => handleInput(acc.id, res, e.target.value)}
                              placeholder="0"
                              className="w-full bg-[#FAF5EA]/50 border border-[#E8DDC9] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2BB673]/50 focus:border-[#2BB673]"
                            />
                          </div>
                        ))}
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
