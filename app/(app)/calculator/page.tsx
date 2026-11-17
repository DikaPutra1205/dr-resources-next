'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, ResourcePrices, ResourceType, Profile, Kingdom } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, RESOURCE_BORDER, cn, parseShorthand, formatInput, fmt } from '@/lib/utils';
import { calculateSmart, calculateManual } from '@/lib/calculator';
import { Loader2, Calculator as CalcIcon, AlertTriangle, Search, Star, Users, CheckSquare, Settings2, Info } from 'lucide-react';
import ResultsTable from './ResultsTable';

export default function CalculatorPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [allAccounts, setAllAccounts] = useState<GameAccount[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [allPrices, setAllPrices] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>('');
  
  // State
  const [activeTab, setActiveTab] = useState<'single' | 'selected' | 'multi' | 'manual'>('single');
  const [kingdomId, setKingdomId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [accountSearch, setAccountSearch] = useState<string>('');
  
  // Inputs (Targets & Interactive Prices)
  const [targets, setTargets] = useState<Record<ResourceType, string>>({ food: '', wood: '', stone: '', gold: '' });
  const [priceInputs, setPriceInputs] = useState<Record<ResourceType, string>>({ food: '', wood: '', stone: '', gold: '' });
  
  // Tab-specific inputs
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [priorityAccountIds, setPriorityAccountIds] = useState<number[]>([]);
  const [multiUserIds, setMultiUserIds] = useState<string[]>([]);
  const [ownerShares, setOwnerShares] = useState<Record<string, string>>({}); // uid -> percentage/share
  const [manualInputs, setManualInputs] = useState<Record<string, Record<ResourceType, string>>>({}); // accId -> res -> value
  
  // Calculation Results
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setSelectedUserId(user.id);
    }

    const [aRes, pRes, profRes, kRes] = await Promise.all([
      supabase.from('game_accounts').select('*, resource_stock:resource_stocks(*)').order('id'),
      supabase.from('resource_prices').select('*'),
      supabase.from('profiles').select('id, name').order('name'),
      supabase.from('kingdoms').select('*').order('name')
    ]);

    const accs = ((aRes.data || []) as any[]).map((a: any) => ({
      ...a,
      resource_stock: Array.isArray(a.resource_stock) ? a.resource_stock[0] : a.resource_stock,
    })) as GameAccount[];
    setAllAccounts(accs);
    if (profRes.data) setProfiles(profRes.data as any);
    if (kRes.data) setKingdoms(kRes.data);
    if (pRes.data) setAllPrices(pRes.data);
    
    // Set initial prices
    const ps = pRes.data || [];
    const pInputs: Record<ResourceType, string> = { food: '', wood: '', stone: '', gold: '' };
    for (const res of RESOURCES) {
      const gp = ps.find((p: any) => p.resource === res && p.kingdom_id === null);
      if (gp && gp.price_per_million > 0) pInputs[res] = gp.price_per_million.toString();
    }
    setPriceInputs(pInputs);
    
    // Initialise selections
    const accIds = accs.map(a => a.id);
    setSelectedAccountIds(accIds);
    const uids = Array.from(new Set(accs.map(a => a.user_id)));
    setMultiUserIds(uids);

    setLoading(false);
  }

  // Real-time listener for stock changes across database
  useEffect(() => {
    const channel = supabase
      .channel('calculator-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_stocks' }, (payload) => {
        const s = payload.new as any;
        setAllAccounts(prev => prev.map(a =>
          a.id === s.game_account_id ? { ...a, resource_stock: { ...(a.resource_stock || {}), ...s } } : a
        ));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle Kingdom selection changes to update default prices and filter selections
  useEffect(() => {
    if (loading) return;

    // Get prices for the selected kingdom
    const pInputs: Record<ResourceType, string> = { food: '', wood: '', stone: '', gold: '' };
    for (const res of RESOURCES) {
      let price = 0;
      if (kingdomId !== null) {
        const kp = allPrices.find(p => p.resource === res && p.kingdom_id === kingdomId);
        if (kp) price = kp.price_per_million;
      }
      if (price === 0) {
        const gp = allPrices.find(p => p.resource === res && p.kingdom_id === null);
        if (gp) price = gp.price_per_million;
      }
      pInputs[res] = price > 0 ? price.toString() : '';
    }
    setPriceInputs(pInputs);

    // Filter list selection states
    const filteredAccs = allAccounts.filter(a => kingdomId === null || a.kingdom_id === kingdomId);
    setSelectedAccountIds(filteredAccs.map(a => a.id));

    const filteredUsers = profiles.filter(p => allAccounts.some(a => a.user_id === p.id && (kingdomId === null || a.kingdom_id === kingdomId)));
    const userIds = filteredUsers.map(p => p.id);
    setMultiUserIds(userIds);

    // Equalize shares default
    if (userIds.length > 0) {
      const eqShare = (100 / userIds.length).toFixed(1).replace('.0', '');
      const sMap: Record<string, string> = {};
      userIds.forEach(uid => { sMap[uid] = eqShare; });
      setOwnerShares(sMap);
    }
  }, [kingdomId, allAccounts, allPrices, profiles]);

  // Trigger calculation when inputs or active tab change
  useEffect(() => {
    if (loading) return;
    handleCalculate();
  }, [
    activeTab,
    targets,
    priceInputs,
    priorityAccountIds,
    ownerShares,
    selectedAccountIds,
    multiUserIds,
    manualInputs,
    allAccounts,
    selectedUserId,
    kingdomId
  ]);

  function handleCalculate() {
    let pool: GameAccount[] = [];
    const numericTargets = {
      food: parseShorthand(targets.food),
      wood: parseShorthand(targets.wood),
      stone: parseShorthand(targets.stone),
      gold: parseShorthand(targets.gold),
    };

    const numericPrices: ResourcePrices = {
      food: parseShorthand(priceInputs.food),
      wood: parseShorthand(priceInputs.wood),
      stone: parseShorthand(priceInputs.stone),
      gold: parseShorthand(priceInputs.gold),
    };

    let res = null;

    if (activeTab === 'single') {
      pool = allAccounts.filter(a => a.user_id === selectedUserId && (kingdomId === null || a.kingdom_id === kingdomId));
      res = calculateSmart(pool, numericTargets, numericPrices);
    } 
    else if (activeTab === 'selected') {
      pool = allAccounts.filter(a => selectedAccountIds.includes(a.id) && (kingdomId === null || a.kingdom_id === kingdomId));
      res = calculateSmart(pool, numericTargets, numericPrices, { priorityAccountIds });
    }
    else if (activeTab === 'multi') {
      pool = allAccounts.filter(a => multiUserIds.includes(a.user_id) && (kingdomId === null || a.kingdom_id === kingdomId));
      const numericOwnerShares: Record<string, number> = {};
      multiUserIds.forEach(uid => {
        numericOwnerShares[uid] = parseFloat(ownerShares[uid]) || (100 / Math.max(1, multiUserIds.length));
      });
      res = calculateSmart(pool, numericTargets, numericPrices, { priorityAccountIds, ownerShares: numericOwnerShares });
    }
    else if (activeTab === 'manual') {
      pool = allAccounts.filter(a => selectedAccountIds.includes(a.id) && (kingdomId === null || a.kingdom_id === kingdomId));
      const numericManual: Record<string, Record<ResourceType, number>> = {};
      for (const accId of selectedAccountIds) {
        numericManual[accId] = {} as any;
        for (const res of RESOURCES) {
          numericManual[accId][res] = parseShorthand(manualInputs[accId]?.[res] || '');
        }
      }
      res = calculateManual(pool, numericManual, numericPrices);
    }

    setResult(res);
  }

  function togglePriorityAccount(accId: number) {
    setPriorityAccountIds(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  }

  function handleEqualizeShares() {
    if (multiUserIds.length === 0) return;
    const equalShare = (100 / multiUserIds.length).toFixed(1).replace('.0', '');
    const newShares: Record<string, string> = {};
    multiUserIds.forEach(uid => {
      newShares[uid] = equalShare;
    });
    setOwnerShares(newShares);
  }

  const tabs = [
    { id: 'single', label: 'Single User (Smart)' },
    { id: 'selected', label: 'Pilih Akun Tertentu' },
    { id: 'multi', label: 'Multi Anggota (Fair Share)' },
    { id: 'manual', label: 'Manual Input (Net)' },
  ];

  // Group accounts by owner name (taking selected kingdom and search into account)
  const groupedAccounts: Record<string, GameAccount[]> = {};
  const searchLower = accountSearch.trim().toLowerCase();
  const filteredAllAccounts = allAccounts.filter(acc => {
    if (kingdomId !== null && acc.kingdom_id !== kingdomId) return false;
    if (searchLower) {
      const ownerName = profiles.find(p => p.id === acc.user_id)?.name || '';
      return acc.name.toLowerCase().includes(searchLower) || ownerName.toLowerCase().includes(searchLower);
    }
    return true;
  });
  filteredAllAccounts.forEach(acc => {
    const ownerName = profiles.find(p => p.id === acc.user_id)?.name || 'Tanpa Pemilik';
    if (!groupedAccounts[ownerName]) {
      groupedAccounts[ownerName] = [];
    }
    groupedAccounts[ownerName].push(acc);
  });

  const selectedAccsForManual = allAccounts.filter(acc => selectedAccountIds.includes(acc.id) && (kingdomId === null || acc.kingdom_id === kingdomId));

  // True when user has typed at least one non-zero value
  const hasAnyInput = activeTab === 'manual'
    ? Object.values(manualInputs).some(acc => RESOURCES.some(res => parseShorthand(acc?.[res] || '') > 0))
    : RESOURCES.some(res => parseShorthand(targets[res]) > 0);

  // Total order value calculated in real-time
  const totalOrderValue = useMemo(() => {
    return RESOURCES.reduce((sum, res) => {
      const t = parseShorthand(targets[res]);
      const p = parseShorthand(priceInputs[res]);
      return sum + (t > 0 && p > 0 ? (t / 1_000_000) * p : 0);
    }, 0);
  }, [targets, priceInputs]);

  // Derived current numeric prices
  const currentNumericPrices: ResourcePrices = useMemo(() => ({
    food: parseShorthand(priceInputs.food),
    wood: parseShorthand(priceInputs.wood),
    stone: parseShorthand(priceInputs.stone),
    gold: parseShorthand(priceInputs.gold),
  }), [priceInputs]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Kalkulator Pengiriman</h1>
        <p className="text-sm text-[#6B8079] mt-1">Hitung alokasi pengiriman resource otomatis dengan efisiensi teleport & pembagian kuota adil.</p>
      </div>

      {/* KINGDOM FILTER & TABS */}
      <div className="space-y-3">
        <div className="bg-white p-3.5 rounded-xl border border-[#E8DDC9] shadow-sm flex items-center gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 text-xs font-bold text-[#5C6E6E] uppercase tracking-wider whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-[#2BB673]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
            Filter Kingdom:
          </div>
          <select 
            value={kingdomId || ''} 
            onChange={e => setKingdomId(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 max-w-xs rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm font-semibold py-2 px-3 outline-none"
          >
            <option value="">-- Semua Kingdom --</option>
            {kingdoms.map(kd => (
              <option key={kd.id} value={kd.id}>{kd.name}</option>
            ))}
          </select>
          {kingdomId && (() => {
            const activeKingdom = kingdoms.find(k => k.id === kingdomId);
            return activeKingdom ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: activeKingdom.color_hex }}>
                {activeKingdom.name}
              </span>
            ) : null;
          })()}
          <p className="text-[10px] text-[#5C6E6E] ml-auto hidden md:block">Pilih kingdom untuk memfilter akun game & rate harga default.</p>
        </div>

        {/* TABS */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-[#E8DDC9] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-[#0E3D40] text-white shadow" 
                  : "text-[#6B8079] hover:bg-[#FAF5EA] hover:text-[#0E3D40]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONFIGURATION ROW (2 spacious cards side by side on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Card 1: Target Pesanan & Rate Pasar (Wajib) (lg:col-span-6) */}
        <div className="lg:col-span-6 card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8DDC9] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
                <CalcIcon className="w-4 h-4 text-[#2BB673]" />
                Target Pesanan & Rate Pasar
              </h3>
              <p className="text-[11px] text-[#6B8079] mt-0.5">Input jumlah bersih yang diterima dan harga pasar per juta (wajib diisi).</p>
            </div>
            {totalOrderValue > 0 && (
              <span className="text-xs font-black text-[#2BB673] bg-[#2BB673]/10 px-2.5 py-1 rounded-full font-mono">
                Rp {fmt(totalOrderValue)}
              </span>
            )}
          </div>

          <div className="space-y-3.5">
            {RESOURCES.map(res => {
              const targetVal = parseShorthand(targets[res]);
              const priceVal = parseShorthand(priceInputs[res]);
              const subtotal = targetVal > 0 && priceVal > 0 ? (targetVal / 1_000_000) * priceVal : 0;
              const isRateMissing = targetVal > 0 && (!priceVal || priceVal <= 0);

              return (
                <div key={res} className="p-3.5 rounded-xl border border-[#E8DDC9]/70 bg-[#FAF5EA]/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0E3D40] capitalize flex items-center gap-1.5">
                      <span className={cn("w-2.5 h-2.5 rounded-full inline-block", RESOURCE_DOT[res])}></span>
                      {RESOURCE_LABELS[res]}
                    </span>
                    {subtotal > 0 && (
                      <span className="text-[11px] font-bold text-[#0E3D40] font-mono">
                        Subtotal: <span className="text-[#2BB673]">Rp {fmt(subtotal)}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[#6B8079] uppercase block mb-1">Target Net</label>
                      <input
                        type="text"
                        placeholder="Contoh: 10.000.000"
                        value={formatInput(targets[res])}
                        onChange={e => setTargets({ ...targets, [res]: e.target.value })}
                        className={cn("input text-xs font-mono font-bold py-2 px-2.5", RESOURCE_BORDER[res])}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-[#6B8079] uppercase">
                          Rate / Juta (Rp) <span className="text-rose-500">*</span>
                        </label>
                        {isRateMissing && (
                          <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 animate-pulse">
                            Wajib!
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B8079]/70">Rp</span>
                        <input
                          type="text"
                          placeholder="3.000"
                          value={formatInput(priceInputs[res])}
                          onChange={e => setPriceInputs({ ...priceInputs, [res]: e.target.value })}
                          className={cn(
                            "input text-xs font-mono font-bold pl-8 py-2 pr-2.5",
                            isRateMissing ? "border-rose-400 bg-rose-50/40" : "border-[#E8DDC9]"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalOrderValue > 0 && (
            <div className="pt-2 border-t border-[#E8DDC9] flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B8079] uppercase">Total Estimasi Nilai Pesanan</span>
              <span className="text-base font-black text-[#0E3D40] font-mono">Rp {fmt(totalOrderValue)}</span>
            </div>
          )}
        </div>

        {/* Card 2: Pengaturan Pengirim & Akun (lg:col-span-6) */}
        <div className="lg:col-span-6 card p-6 space-y-4">
          
          {/* TAB 1: Single User */}
          {activeTab === 'single' && (
            <div className="space-y-4">
              <div className="border-b border-[#E8DDC9] pb-3">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2BB673]" />
                  Pilih Anggota Pengirim
                </h3>
                <p className="text-[11px] text-[#6B8079] mt-0.5">Sistem akan memilih akun-akun terbaik milik anggota ini secara otomatis.</p>
              </div>

              <div>
                <label className="label">Nama Anggota</label>
                <select 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)} 
                  className="w-full rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm py-2.5 px-3 outline-none font-semibold"
                >
                  <option value="">-- Pilih Anggota --</option>
                  {profiles.map(usr => {
                    const uAccsCount = allAccounts.filter(a => a.user_id === usr.id && (kingdomId === null || a.kingdom_id === kingdomId)).length;
                    return (
                      <option key={usr.id} value={usr.id}>
                        {usr.name} ({uAccsCount} Akun)
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedUserId && (() => {
                const userAccs = allAccounts.filter(a => a.user_id === selectedUserId && (kingdomId === null || a.kingdom_id === kingdomId));
                return (
                  <div className="p-3 bg-[#FAF5EA]/50 rounded-xl border border-[#E8DDC9] text-xs text-[#0E3D40] space-y-1">
                    <div className="font-bold">Total Akun Tersedia: <span className="text-[#2BB673]">{userAccs.length} Akun</span></div>
                    <div className="text-[11px] text-[#6B8079]">Sistem akan mengutamakan akun yang bisa ALL IN atau menyuplai pesanan dengan teleport paling hemat.</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: Pilih Akun Tertentu */}
          {activeTab === 'selected' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E8DDC9] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#2BB673]" />
                    Pilih Akun Kontributor
                  </h3>
                  <p className="text-[11px] text-[#6B8079] mt-0.5">Centang akun yang diizinkan dan beri bintang ⭐ untuk prioritas ALL IN.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedAccountIds(allAccounts.filter(a => kingdomId === null || a.kingdom_id === kingdomId).map(a => a.id))} 
                    className="text-[10px] text-[#2BB673] hover:underline font-bold uppercase cursor-pointer"
                  >
                    Semua
                  </button>
                  <span className="text-[#E8DDC9]">|</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedAccountIds([])} 
                    className="text-[10px] text-[#D9745A] hover:underline font-bold uppercase cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6B8079] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari akun atau pemilik..."
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF5EA]/50 border border-[#E8DDC9] rounded-lg text-xs text-[#0E3D40] placeholder-[#6B8079]/60 focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 outline-none font-medium"
                />
                {accountSearch && (
                  <button 
                    type="button" 
                    onClick={() => setAccountSearch('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#6B8079] hover:text-[#0E3D40]"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="max-h-80 overflow-y-auto space-y-3 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="text-xs text-[#6B8079] text-center py-4">Tidak ada akun ditemukan.</div>
                ) : Object.entries(groupedAccounts).map(([ownerName, accs]) => (
                  <div key={ownerName} className="space-y-1">
                    <span className="block text-[10px] font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/50 pb-0.5">{ownerName}</span>
                    {accs.map(ac => {
                      const isChecked = selectedAccountIds.includes(ac.id);
                      const isPriority = priorityAccountIds.includes(ac.id);

                      return (
                        <div key={ac.id} className={cn(
                          "flex items-center justify-between p-2 rounded transition-colors text-xs",
                          isChecked ? "bg-white border border-[#E8DDC9]/60 shadow-xs" : "hover:bg-[#FAF5EA]/80 opacity-60"
                        )}>
                          <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setSelectedAccountIds([...selectedAccountIds, ac.id]);
                                else {
                                  setSelectedAccountIds(selectedAccountIds.filter(id => id !== ac.id));
                                  setPriorityAccountIds(priorityAccountIds.filter(id => id !== ac.id));
                                }
                              }}
                              className="rounded border-[#E8DDC9] text-[#2BB673] focus:ring-[#2BB673]/20 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[#0E3D40] truncate">{ac.name}</div>
                              <div className="text-[9px] text-[#6B8079] uppercase font-semibold">
                                {ac.type} · TP {ac.trading_post_level} / SH {ac.storehouse_level}
                              </div>
                            </div>
                          </label>

                          {isChecked && (
                            <button
                              type="button"
                              onClick={() => togglePriorityAccount(ac.id)}
                              title={isPriority ? "Batal prioritaskan ALL IN" : "Prioritaskan ALL IN akun ini (Disedot habis duluan)"}
                              className={cn(
                                "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer ml-2",
                                isPriority 
                                  ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-xs" 
                                  : "bg-[#FAF5EA] text-[#6B8079] border border-[#E8DDC9] hover:bg-amber-50 hover:text-amber-700"
                              )}
                            >
                              <Star className={cn("w-3 h-3", isPriority ? "text-amber-500 fill-amber-500" : "text-[#6B8079]")} />
                              <span>{isPriority ? "Prioritas" : "Prioritaskan"}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Multi Anggota (Fair Share) */}
          {activeTab === 'multi' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E8DDC9] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#2BB673]" />
                    Pengaturan Porsi Kontributor
                  </h3>
                  <p className="text-[11px] text-[#6B8079] mt-0.5">Bagi kuota nilai pesanan secara adil. Jika stok anggota mentok, sisa dialihkan otomatis.</p>
                </div>
                <button
                  type="button"
                  onClick={handleEqualizeShares}
                  className="px-2.5 py-1 text-[10px] font-bold bg-[#2BB673]/10 text-[#2BB673] hover:bg-[#2BB673]/20 rounded-lg transition-colors cursor-pointer"
                >
                  Bagi Rata (Equal)
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {profiles.filter(p => allAccounts.some(a => a.user_id === p.id && (kingdomId === null || a.kingdom_id === kingdomId))).map(usr => {
                  const isChecked = multiUserIds.includes(usr.id);
                  const uAccs = allAccounts.filter(a => a.user_id === usr.id && (kingdomId === null || a.kingdom_id === kingdomId));
                  
                  // Hitung total kapasitas bersih (Rp) anggota ini
                  const userCapVal = uAccs.reduce((sum, acc) => {
                    return sum + RESOURCES.reduce((rSum, res) => {
                      const sh = (acc.storehouse_level || 1);
                      // perkiraan sendable net sederhana
                      const stock = (acc.resource_stock as any)?.[res] || 0;
                      return rSum + (stock / 1_000_000) * (currentNumericPrices[res] || 0);
                    }, 0);
                  }, 0);

                  return (
                    <div key={usr.id} className={cn(
                      "p-3 rounded-xl border transition-all space-y-2 text-xs",
                      isChecked ? "bg-white border-[#2BB673]/40 shadow-xs" : "bg-[#FAF5EA]/50 border-[#E8DDC9] opacity-60"
                    )}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer font-bold text-[#0E3D40]">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) setMultiUserIds([...multiUserIds, usr.id]);
                              else setMultiUserIds(multiUserIds.filter(id => id !== usr.id));
                            }}
                            className="rounded border-[#E8DDC9] text-[#2BB673] focus:ring-[#2BB673]/20"
                          />
                          <span>{usr.name}</span>
                          <span className="text-[10px] font-normal text-[#6B8079]">({uAccs.length} Akun)</span>
                        </label>

                        {isChecked && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-[#6B8079]">Porsi:</span>
                            <div className="relative w-16">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={ownerShares[usr.id] || ''}
                                onChange={e => setOwnerShares({ ...ownerShares, [usr.id]: e.target.value })}
                                className="w-full text-right font-mono font-bold border border-[#E8DDC9] rounded py-1 px-1.5 pr-4 text-xs outline-none focus:border-[#2BB673]"
                              />
                              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-[#6B8079]">%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Manual Input Picker */}
          {activeTab === 'manual' && (
            <div className="space-y-3">
              <div className="border-b border-[#E8DDC9] pb-3">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-[#2BB673]" />
                  Pilih Akun untuk Input Manual
                </h3>
                <p className="text-[11px] text-[#6B8079] mt-0.5">Centang akun yang ingin diisi nilai kirim bersihnya secara spesifik di bawah.</p>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {allAccounts.filter(a => kingdomId === null || a.kingdom_id === kingdomId).map(ac => (
                  <label key={ac.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-white text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.includes(ac.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedAccountIds([...selectedAccountIds, ac.id]);
                        else setSelectedAccountIds(selectedAccountIds.filter(id => id !== ac.id));
                      }}
                      className="rounded border-[#E8DDC9] text-[#2BB673]"
                    />
                    <span className="font-bold text-[#0E3D40]">{ac.name}</span>
                    <span className="text-[10px] text-[#6B8079]">({profiles.find(p => p.id === ac.user_id)?.name})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* FULL WIDTH RESULTS ROW */}
      <div className="w-full space-y-6">
        
        {/* Tab 4: Manual inputs table */}
        {activeTab === 'manual' && selectedAccsForManual.length > 0 && (
          <div className="card p-6">
            <div className="border-b border-[#E8DDC9] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Input Pengiriman Manual Per Akun</h3>
              <p className="text-[11px] text-[#6B8079] mt-0.5">Input jumlah <strong>bersih (net)</strong> yang ingin diterima per akun.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 w-1/4">Akun</th>
                    {RESOURCES.map(res => <th key={res} className="py-2.5 px-3 text-right capitalize">{res} (Net)</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DDC9]/50">
                  {selectedAccsForManual.map(acc => (
                    <tr key={acc.id} className="hover:bg-[#FAF5EA]/50">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#0E3D40] truncate max-w-[140px]">{acc.name}</div>
                        <div className="text-[10px] text-[#6B8079] mt-0.5">
                          {profiles.find(p => p.id === acc.user_id)?.name || 'N/A'}
                        </div>
                      </td>
                      {RESOURCES.map(res => (
                        <td key={res} className="py-3 px-3">
                          <input 
                            type="text" 
                            placeholder="0"
                            value={formatInput(manualInputs[acc.id]?.[res] || '')}
                            onChange={e => {
                              setManualInputs({
                                ...manualInputs,
                                [acc.id]: {
                                  ...(manualInputs[acc.id] || {}),
                                  [res]: e.target.value
                                }
                              });
                            }}
                            className={cn("w-full text-right font-mono font-semibold rounded-lg text-xs py-1.5 px-2 border outline-none", RESOURCE_BORDER[res])}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RESULTS COMPONENT (FULL WIDTH) */}
        {result && (
          <ResultsTable 
            result={result} 
            prices={currentNumericPrices} 
            activeTab={activeTab} 
            supabase={supabase} 
            userId={userId} 
            kingdomId={kingdomId}
            kingdoms={kingdoms}
            hasAnyInput={hasAnyInput}
            ownerShares={ownerShares}
            profiles={profiles}
          />
        )}
      </div>
    </div>
  );
}
