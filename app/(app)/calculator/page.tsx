'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, ResourcePrices, ResourceType, Profile, Kingdom } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, RESOURCE_BORDER, cn, parseShorthand, formatInput } from '@/lib/utils';
import { calculateSmart, calculateManual } from '@/lib/calculator';
import { Loader2, Calculator as CalcIcon, AlertTriangle } from 'lucide-react';
import ResultsTable from './ResultsTable';

export default function CalculatorPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [allAccounts, setAllAccounts] = useState<GameAccount[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [allPrices, setAllPrices] = useState<any[]>([]);
  const [prices, setPrices] = useState<ResourcePrices>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [userId, setUserId] = useState<string>('');
  
  // State
  const [activeTab, setActiveTab] = useState<'single' | 'selected' | 'multi' | 'manual'>('single');
  const [kingdomId, setKingdomId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Inputs (Targets)
  const [targets, setTargets] = useState<Record<ResourceType, string>>({ food: '', wood: '', stone: '', gold: '' });
  
  // Tab-specific inputs
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [multiUserIds, setMultiUserIds] = useState<string[]>([]);
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
    
    // Set initial prices (global fallback)
    const ps = pRes.data || [];
    const pMap: ResourcePrices = { food: 0, wood: 0, stone: 0, gold: 0 };
    ps.filter(p => p.kingdom_id === null).forEach(p => pMap[p.resource as ResourceType] = p.price_per_million);
    setPrices(pMap);
    
    // Initialise selections
    const accIds = accs.map(a => a.id);
    setSelectedAccountIds(accIds);
    const uids = Array.from(new Set(accs.map(a => a.user_id)));
    setMultiUserIds(uids);

    setLoading(false);
  }

  // Handle Kingdom selection changes to update prices and filter selections
  useEffect(() => {
    if (loading) return;

    // 1. Get prices for the selected kingdom
    const resultPrices: ResourcePrices = { food: 0, wood: 0, stone: 0, gold: 0 };
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
      resultPrices[res] = price;
    }
    setPrices(resultPrices);

    // 2. Filter list selection states
    const filteredAccs = allAccounts.filter(a => kingdomId === null || a.kingdom_id === kingdomId);
    setSelectedAccountIds(filteredAccs.map(a => a.id));

    const filteredUsers = profiles.filter(p => allAccounts.some(a => a.user_id === p.id && (kingdomId === null || a.kingdom_id === kingdomId)));
    setMultiUserIds(filteredUsers.map(p => p.id));
  }, [kingdomId, allAccounts, allPrices, profiles]);

  // Trigger calculation when inputs or active tab change
  useEffect(() => {
    if (loading) return;
    handleCalculate();
  }, [activeTab, targets, selectedAccountIds, multiUserIds, manualInputs, allAccounts, prices, selectedUserId, kingdomId]);

  function handleCalculate() {
    let pool: GameAccount[] = [];
    const numericTargets = {
      food: parseShorthand(targets.food),
      wood: parseShorthand(targets.wood),
      stone: parseShorthand(targets.stone),
      gold: parseShorthand(targets.gold),
    };

    let res = null;

    if (activeTab === 'single') {
      pool = allAccounts.filter(a => a.user_id === selectedUserId && (kingdomId === null || a.kingdom_id === kingdomId));
      res = calculateSmart(pool, numericTargets, prices);
    } 
    else if (activeTab === 'selected') {
      pool = allAccounts.filter(a => selectedAccountIds.includes(a.id) && (kingdomId === null || a.kingdom_id === kingdomId));
      res = calculateSmart(pool, numericTargets, prices);
    }
    else if (activeTab === 'multi') {
      pool = allAccounts.filter(a => multiUserIds.includes(a.user_id) && (kingdomId === null || a.kingdom_id === kingdomId));
      res = calculateSmart(pool, numericTargets, prices);
    }
    else if (activeTab === 'manual') {
      pool = allAccounts.filter(a => selectedAccountIds.includes(a.id) && (kingdomId === null || a.kingdom_id === kingdomId));
      // Convert manualInputs string to numbers
      const numericManual: Record<string, Record<ResourceType, number>> = {};
      for (const accId of selectedAccountIds) {
        numericManual[accId] = {} as any;
        for (const res of RESOURCES) {
          numericManual[accId][res] = parseShorthand(manualInputs[accId]?.[res] || '');
        }
      }
      res = calculateManual(pool, numericManual, prices);
    }

    setResult(res);
  }

  const tabs = [
    { id: 'single', label: 'Single User (Smart)' },
    { id: 'selected', label: 'Pilih Akun Tertentu' },
    { id: 'multi', label: 'Multi Anggota (Smart)' },
    { id: 'manual', label: 'Manual Input (Net)' },
  ];

  // Group accounts by owner name (taking selected kingdom into account)
  const groupedAccounts: Record<string, GameAccount[]> = {};
  const filteredAllAccounts = allAccounts.filter(acc => kingdomId === null || acc.kingdom_id === kingdomId);
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

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Kalkulator Pengiriman</h1>
        <p className="text-sm text-[#6B8079] mt-1">Hitung otomatis gross pengiriman, sisa stok, dan trip yang dibutuhkan.</p>
      </div>

      {/* KINGDOM FILTER */}
      <div className="bg-white p-4 rounded-xl border border-[#E8DDC9] shadow-sm flex items-center gap-4 flex-wrap sm:flex-nowrap">
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
        <p className="text-[10px] text-[#5C6E6E] ml-auto hidden md:block">Pilih kingdom untuk memfilter akun game yang tampil di semua tab kalkulator.</p>
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

      {/* INPUTS AND PANEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Target Inputs & Selections */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Tab 1 specific: Select User */}
          {activeTab === 'single' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9] pb-2">Anggota Pengirim</h3>
              <div>
                <select 
                  id="user-select" 
                  value={selectedUserId} 
                  onChange={e => setSelectedUserId(e.target.value)} 
                  className="w-full rounded-lg border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm py-2 px-3 outline-none font-semibold"
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
            </div>
          )}

          {/* Target inputs for Tabs 1, 2, 3 */}
          {activeTab !== 'manual' && (
            <div className="card p-6">
              <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider mb-4 border-b border-[#E8DDC9] pb-2">Target Diterima (Bersih)</h3>
              <div className="space-y-4">
                {RESOURCES.map(res => (
                  <div key={res}>
                    <label className="label capitalize flex items-center gap-1.5">
                      <span className={cn("w-2.5 h-2.5 rounded-full inline-block", RESOURCE_DOT[res])}></span>
                      {RESOURCE_LABELS[res]}
                    </label>
                    <input 
                      type="text"
                      placeholder="Contoh: 10.000.000"
                      value={formatInput(targets[res])}
                      onChange={e => setTargets({...targets, [res]: e.target.value})}
                      className={cn("input font-mono font-semibold", RESOURCE_BORDER[res])}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2 specific: Select Accounts Checkboxes */}
          {activeTab === 'selected' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#E8DDC9] pb-2">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Pilih Akun Game</h3>
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
              
              <div className="max-h-80 overflow-y-auto space-y-4 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="text-xs text-[#6B8079] text-center py-4">Tidak ada akun ditemukan.</div>
                ) : Object.entries(groupedAccounts).map(([ownerName, accs]) => (
                  <div key={ownerName} className="space-y-1">
                    <span className="block text-[10px] font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/50 pb-0.5">{ownerName}</span>
                    {accs.map(ac => (
                      <label key={ac.id} className="flex items-start gap-2.5 p-1 rounded hover:bg-[#FAF5EA] cursor-pointer transition-colors text-xs pl-2">
                        <input 
                          type="checkbox" 
                          checked={selectedAccountIds.includes(ac.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedAccountIds([...selectedAccountIds, ac.id]);
                            else setSelectedAccountIds(selectedAccountIds.filter(id => id !== ac.id));
                          }}
                          className="rounded border-[#E8DDC9] text-[#2BB673] focus:ring-[#2BB673]/20 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-[#0E3D40]">{ac.name}</div>
                          <div className="text-[9px] text-[#6B8079] uppercase font-semibold">
                            {ac.type} (TP {ac.trading_post_level} / SH Lvl {ac.storehouse_level})
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3 specific: Select Users Checkboxes */}
          {activeTab === 'multi' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#E8DDC9] pb-2">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Pilih Anggota</h3>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setMultiUserIds(profiles.filter(p => allAccounts.some(a => a.user_id === p.id && (kingdomId === null || a.kingdom_id === kingdomId))).map(p => p.id))} 
                    className="text-[10px] text-[#2BB673] hover:underline font-bold uppercase cursor-pointer"
                  >
                    Semua
                  </button>
                  <span className="text-[#E8DDC9]">|</span>
                  <button 
                    type="button" 
                    onClick={() => setMultiUserIds([])} 
                    className="text-[10px] text-[#D9745A] hover:underline font-bold uppercase cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
              
              <div className="max-h-72 overflow-y-auto space-y-2 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {profiles.filter(p => allAccounts.some(a => a.user_id === p.id && (kingdomId === null || a.kingdom_id === kingdomId))).map(usr => {
                  const uAccs = allAccounts.filter(a => a.user_id === usr.id && (kingdomId === null || a.kingdom_id === kingdomId));
                  return (
                    <label key={usr.id} className="flex items-start gap-3 p-2 rounded hover:bg-[#FAF5EA] cursor-pointer transition-colors text-xs">
                      <input 
                        type="checkbox" 
                        checked={multiUserIds.includes(usr.id)}
                        onChange={e => {
                          if (e.target.checked) setMultiUserIds([...multiUserIds, usr.id]);
                          else setMultiUserIds(multiUserIds.filter(id => id !== usr.id));
                        }}
                        className="rounded border-[#E8DDC9] text-[#2BB673] focus:ring-[#2BB673]/20 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-[#0E3D40]">{usr.name}</div>
                        <div className="text-[10px] text-[#6B8079]">
                          {uAccs.length} Akun Game
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4 specific: Contributor Accounts Checklist */}
          {activeTab === 'manual' && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[#E8DDC9] pb-2">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Akun Kontributor</h3>
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
              
              <div className="max-h-80 overflow-y-auto space-y-4 border border-[#E8DDC9] rounded-lg p-3 bg-[#FAF5EA]/30">
                {Object.keys(groupedAccounts).length === 0 ? (
                  <div className="text-xs text-[#6B8079] text-center py-4">Tidak ada akun ditemukan.</div>
                ) : Object.entries(groupedAccounts).map(([ownerName, accs]) => (
                  <div key={ownerName} className="space-y-1">
                    <span className="block text-[10px] font-bold text-[#0E3D40] uppercase tracking-wider border-b border-[#E8DDC9]/50 pb-0.5">{ownerName}</span>
                    {accs.map(ac => (
                      <label key={ac.id} className="flex items-start gap-2.5 p-1 rounded hover:bg-[#FAF5EA] cursor-pointer transition-colors text-xs pl-2">
                        <input 
                          type="checkbox" 
                          checked={selectedAccountIds.includes(ac.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedAccountIds([...selectedAccountIds, ac.id]);
                            else setSelectedAccountIds(selectedAccountIds.filter(id => id !== ac.id));
                          }}
                          className="rounded border-[#E8DDC9] text-[#2BB673] focus:ring-[#2BB673]/20 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-[#0E3D40]">{ac.name}</div>
                          <div className="text-[9px] text-[#6B8079] uppercase font-semibold">
                            {ac.type} (TP {ac.trading_post_level} / SH Lvl {ac.storehouse_level})
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Col: Manual Input OR Results Summary */}
        <div className="lg:col-span-8">
          
          {/* Tab 1 empty check */}
          {activeTab === 'single' && !selectedUserId && (
            <div className="bg-white p-12 rounded-xl border border-[#E8DDC9] text-center shadow-sm">
              <svg className="w-12 h-12 text-[#6B8079] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <h4 className="text-lg font-bold text-[#0E3D40] mb-1">Pilih Anggota Pengirim</h4>
              <p className="text-xs text-[#6B8079]">Pilih nama anggota pengirim di panel sebelah kiri untuk menghitung kalkulasi pengiriman resource.</p>
            </div>
          )}

          {/* Tab 2 empty check */}
          {activeTab === 'selected' && selectedAccountIds.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-[#E8DDC9] text-center shadow-sm">
              <svg className="w-12 h-12 text-[#6B8079] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM5.25 6H18a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0118 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6z" />
              </svg>
              <h4 className="text-lg font-bold text-[#0E3D40] mb-1">Kalkulator Pilihan Akun</h4>
              <p className="text-xs text-[#6B8079]">Pilih akun-akun game pengirim di sebelah kiri untuk memulai kalkulasi kontribusi.</p>
            </div>
          )}

          {/* Tab 3 empty check */}
          {activeTab === 'multi' && multiUserIds.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-[#E8DDC9] text-center shadow-sm">
              <svg className="w-12 h-12 text-[#6B8079] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <h4 className="text-lg font-bold text-[#0E3D40] mb-1">Kalkulator Multi-Anggota</h4>
              <p className="text-xs text-[#6B8079]">Centang nama anggota kontributor di sebelah kiri untuk menghitung kapasitas kontribusi gabungan.</p>
            </div>
          )}

          {/* Tab 4 empty check */}
          {activeTab === 'manual' && selectedAccsForManual.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-[#E8DDC9] text-center shadow-sm">
              <svg className="w-12 h-12 text-[#6B8079] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 2.24a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM5.25 6H18a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0118 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6z" />
              </svg>
              <h4 className="text-lg font-bold text-[#0E3D40] mb-1">Kalkulator Manual Per Akun</h4>
              <p className="text-xs text-[#6B8079]">Pilih akun-akun game pengirim di sebelah kiri untuk mengisi resource yang akan dikirim secara manual.</p>
            </div>
          )}

          {/* Tab 4: Manual inputs table */}
          {activeTab === 'manual' && selectedAccsForManual.length > 0 && (
            <div className="card p-6 mb-6">
              <div className="border-b border-[#E8DDC9] pb-3 mb-4">
                <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Input Pengiriman Manual</h3>
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
                          <div className="font-bold text-[#0E3D40] truncate max-w-[120px]">{acc.name}</div>
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

          {/* RESULTS COMPONENT */}
          {result && (
             <ResultsTable 
               result={result} 
               prices={prices} 
               activeTab={activeTab} 
               supabase={supabase} 
               userId={userId} 
               kingdomId={kingdomId}
               kingdoms={kingdoms}
               hasAnyInput={hasAnyInput}
             />
          )}

        </div>
      </div>
    </div>
  );
}
