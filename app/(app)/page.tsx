'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, Kingdom, Profile, ResourceType } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, RESOURCE_BORDER, fmt, parseShorthand, formatInput, getSendable, cn } from '@/lib/utils';
import { Loader2, Gamepad2, Search, ArrowLeftRight, HelpCircle, Check, Shield, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { log } from '@/lib/logger';

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  // Core Data
  const [accounts, setAccounts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);

  // Pricing state
  const [globalPrices, setGlobalPrices] = useState<Record<ResourceType, number>>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [kingdomPrices, setKingdomPrices] = useState<Record<number, Record<ResourceType, number>>>({});

  // Auth Info
  const [userId, setUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKingdom, setActiveKingdom] = useState<string>('all');
  const [filterUserId, setFilterUserId] = useState<string>('');

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ accId: number; resource: ResourceType } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [successCells, setSuccessCells] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();

    // Real-time subscription for stock updates
    const channel = supabase
      .channel('dashboard-stock-changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'resource_stocks' },
        (payload) => {
          const newStock = payload.new as any;
          setAccounts(prev => prev.map(a =>
            a.id === newStock.game_account_id
              ? { ...a, resource_stock: { ...(a.resource_stock || {}), ...newStock } }
              : a
          ));
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'resource_stocks' },
        (payload) => {
          const newStock = payload.new as any;
          setAccounts(prev => prev.map(a =>
            a.id === newStock.game_account_id
              ? { ...a, resource_stock: { ...(a.resource_stock || {}), ...newStock } }
              : a
          ));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    setLoading(true);

    // Auth & Profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
    }

    // Parallel fetch from DB
    const [accRes, kRes, pRes, prRes] = await Promise.all([
      supabase.from('game_accounts').select(`
        *,
        kingdom:kingdoms(*),
        resource_stock:resource_stocks(*),
        profile:profiles(*)
      `).order('id'),
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('resource_prices').select('*')
    ]);

    if (accRes.data) setAccounts(accRes.data);
    if (kRes.data) setKingdoms(kRes.data);
    if (pRes.data) setProfiles(pRes.data);

    // Calculate Prices Mapping
    const gPrices = { food: 0, wood: 0, stone: 0, gold: 0 } as Record<ResourceType, number>;
    const kPrices = {} as Record<number, Record<ResourceType, number>>;

    const pricesList = prRes.data || [];

    // Global Prices
    pricesList.forEach(p => {
      if (p.kingdom_id === null) {
        gPrices[p.resource as ResourceType] = Number(p.price_per_million);
      }
    });

    // Preset Kingdoms
    const kList = kRes.data || [];
    kList.forEach(k => {
      kPrices[k.id] = { ...gPrices };
    });

    // Specific prices overrides
    pricesList.forEach(p => {
      if (p.kingdom_id !== null) {
        if (!kPrices[p.kingdom_id]) {
          kPrices[p.kingdom_id] = { ...gPrices };
        }
        kPrices[p.kingdom_id][p.resource as ResourceType] = Number(p.price_per_million);
      }
    });

    setGlobalPrices(gPrices);
    setKingdomPrices(kPrices);
    setLoading(false);
  }

  // Price & Value Helpers
  function getAccountPrice(acc: any, resource: ResourceType): number {
    const kid = acc.kingdom_id;
    if (kid && kingdomPrices[kid]) {
      return kingdomPrices[kid][resource];
    }
    return globalPrices[resource];
  }

  // Helper to resolve Kingdom Name for filtering
  function getKingdomName(acc: any): string {
    if (acc.kingdom && typeof acc.kingdom === 'object') {
      return acc.kingdom.name;
    }
    return acc.kingdom || 'Tanpa Kingdom';
  }

  // Dynamically extract active kingdoms for navigation tabs
  const kingdomTabs = useMemo(() => {
    // Collect from current filtered user (or all)
    const sourceAccs = filterUserId ? accounts.filter(a => a.user_id === filterUserId) : accounts;
    const unique = new Set<string>();
    sourceAccs.forEach(acc => {
      const name = getKingdomName(acc);
      if (name && name !== 'Tanpa Kingdom') {
        unique.add(name);
      }
    });
    return Array.from(unique).sort();
  }, [accounts, filterUserId]);

  // Filters application
  const filteredAccounts = useMemo(() => {
    let list = [...accounts];

    // Non-admin: only see own accounts
    if (!isAdmin) {
      list = list.filter(acc => acc.user_id === userId);
    }

    // Filter by Owner (Admin dropdown)
    if (filterUserId) {
      list = list.filter(acc => acc.user_id === filterUserId);
    }

    // Filter by Kingdom Tab
    if (activeKingdom !== 'all') {
      list = list.filter(acc => getKingdomName(acc) === activeKingdom);
    }

    // Filter by Search text
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(acc =>
        acc.name.toLowerCase().includes(q) ||
        (acc.profile?.name && acc.profile.name.toLowerCase().includes(q))
      );
    }

    // Order like Laravel: Admin Owner name ASC, Main first, Account name ASC
    return list.sort((a, b) => {
      const nameA = a.profile?.name || '';
      const nameB = b.profile?.name || '';
      const ownerComp = nameA.localeCompare(nameB);
      if (ownerComp !== 0) return ownerComp;

      const typeA = a.type === 'main' ? 0 : 1;
      const typeB = b.type === 'main' ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;

      return a.name.localeCompare(b.name);
    });
  }, [accounts, filterUserId, activeKingdom, searchQuery]);

  // Aggregated summaries
  const totals = useMemo(() => {
    const sums = { food: 0, wood: 0, stone: 0, gold: 0 };
    const values = { food: 0, wood: 0, stone: 0, gold: 0 };

    filteredAccounts.forEach(acc => {
      const stock = acc.resource_stock;
      if (!stock) return;
      RESOURCES.forEach(res => {
        const qty = Number(stock[res]) || 0;
        sums[res] += qty;
        values[res] += (qty * getAccountPrice(acc, res)) / 1000000;
      });
    });

    return {
      sums,
      values,
    };
  }, [filteredAccounts, globalPrices, kingdomPrices]);

  // Handle cell edit activation
  function startEditing(accId: number, resource: ResourceType, currentVal: number) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;

    // Check permission (Admin or owner)
    const canEdit = isAdmin || acc.user_id === userId;
    if (!canEdit) return;

    setEditingCell({ accId, resource });
    setEditValue(currentVal > 0 ? currentVal.toString() : '');
  }

  // Handle saving the inline edit
  async function handleSaveEdit(accId: number, resource: ResourceType) {
    if (!editingCell) return;

    const parsedValue = parseShorthand(editValue);
    const cleanValue = Math.max(0, parsedValue);

    const acc = accounts.find(a => a.id === accId);
    const oldVal = acc?.resource_stock?.[resource] ?? 0;

    // If no change, just exit
    if (cleanValue === oldVal) {
      setEditingCell(null);
      return;
    }

    const cellKey = `${accId}-${resource}`;
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    setEditingCell(null); // Close input immediately for snappy UX

    try {
      const { error } = await supabase
        .from('resource_stocks')
        .update({ [resource]: cleanValue, updated_at: new Date().toISOString() })
        .eq('game_account_id', accId);

      if (error) throw error;

      // Update local state
      setAccounts(prev => prev.map(a => {
        if (a.id === accId) {
          return {
            ...a,
            resource_stock: {
              ...(a.resource_stock || {}),
              [resource]: cleanValue
            }
          };
        }
        return a;
      }));

      log('stock.update', { game_account_id: accId, resource, old_value: oldVal, new_value: cleanValue });

      // Trigger success animation
      setSuccessCells(prev => ({ ...prev, [cellKey]: true }));
      setTimeout(() => {
        setSuccessCells(prev => ({ ...prev, [cellKey]: false }));
      }, 1500);

    } catch (err: any) {
      alert('Gagal mengupdate stok: ' + err.message);
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Ringkasan Dashboard</h1>
          <p className="text-sm text-[#6B8079] mt-1">Kelola stok dan pantau total kapasitas persediaan guild secara real-time.</p>
        </div>
      </div>

      {/* Admin User Filter Dropdown */}
      {isAdmin && (
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-[#E8DDC9] shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0E3D40]/10 flex items-center justify-center text-[#0E3D40]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0E3D40]">Filter Pemilik Akun (Admin Only)</h4>
              <p className="text-[10px] text-[#5C6E6E]">Tampilkan data statistik dan persediaan berdasarkan pemilik akun game.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterUserId}
              onChange={e => {
                setFilterUserId(e.target.value);
                setActiveKingdom('all'); // Reset kingdom tab to prevent empty state mismatch
              }}
              className="rounded-lg border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-xs py-1.5 px-3 font-semibold outline-none transition-colors"
            >
              <option value="">Semua Pengguna</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
            {filterUserId && (
              <button onClick={() => { setFilterUserId(''); setActiveKingdom('all'); }} className="text-xs text-[#D9745A] font-bold hover:underline">
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Kingdom Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E8DDC9]/60 pb-3">
        <button
          onClick={() => setActiveKingdom('all')}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all duration-200",
            activeKingdom === 'all'
              ? "bg-[#0E3D40] text-white border-[#0E3D40]"
              : "bg-white text-[#5C6E6E] border-[#E8DDC9] hover:bg-[#FAF5EA]/50"
          )}
        >
          Semua Kingdom
        </button>
        {kingdomTabs.map(name => (
          <button
            key={name}
            onClick={() => setActiveKingdom(name)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold border shadow-sm transition-all duration-200",
              activeKingdom === name
                ? "bg-[#0E3D40] text-white border-[#0E3D40]"
                : "bg-white text-[#5C6E6E] border-[#E8DDC9] hover:bg-[#FAF5EA]/50"
            )}
          >
            Kingdom {name}
          </button>
        ))}
      </div>

      {/* Account Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-[#5C6E6E] uppercase tracking-wider mb-0.5">Jumlah Akun</span>
            <span className="text-2xl font-black text-[#0E3D40]">{filteredAccounts.length}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#0E3D40]/5 flex items-center justify-center text-[#0E3D40]">
            <Gamepad2 className="w-5 h-5" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-[#5C6E6E] uppercase tracking-wider mb-0.5">Akun Main</span>
            <span className="text-2xl font-black text-[#0E3D40]">
              {filteredAccounts.filter(acc => acc.type === 'main').length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#2BB673]/10 flex items-center justify-center text-[#2BB673]">
            <Check className="w-5 h-5" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-[#5C6E6E] uppercase tracking-wider mb-0.5">Akun Farm</span>
            <span className="text-2xl font-black text-[#0E3D40]">
              {filteredAccounts.filter(acc => acc.type === 'farm').length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#D9745A]/10 flex items-center justify-center text-[#D9745A]">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-[#E8DDC9] shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-[#E8DDC9] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FAF5EA]/35 gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Stok Persediaan Akun Game</h3>
            <p className="text-xs text-[#6B8079] mt-0.5">Klik cell angka stok untuk mengedit stok Anda secara langsung (input angka).</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama akun atau pemilik..."
                className="w-full rounded-lg border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-white text-xs py-1.5 pl-8 pr-3 font-semibold shadow-inner outline-none transition-colors"
              />
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#6B8079]">
                <Search className="w-4 h-4" />
              </span>
            </div>
            <Link
              href="/game-accounts"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#2BB673] hover:bg-[#23945d] rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              Kelola Akun
            </Link>
          </div>
        </div>

        {/* Scrollable Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF5EA] text-[#5C6E6E] border-b border-[#E8DDC9] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 w-1/6 min-w-[130px]">Akun</th>
                <th className="py-3.5 px-3 w-1/12 min-w-[100px]">Pemilik</th>
                <th className="py-3.5 px-3 text-center w-[8%] min-w-[80px]">Tipe</th>
                <th className="py-3.5 px-3 text-center w-[8%] min-w-[100px]">Kingdom</th>
                <th className="py-3.5 px-3 text-center w-[8%] min-w-[80px]">TP/SH Lvl</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3.5 px-3 text-right w-1/12 min-w-[100px]">{RESOURCE_LABELS[res]}</th>
                ))}

              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#6B8079] font-medium">
                    Tidak ada akun game yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const hasWriteAccess = isAdmin || acc.user_id === userId;
                  return (
                    <tr key={acc.id} className="hover:bg-[#FAF5EA]/20 transition-colors group">
                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-[#0E3D40] whitespace-nowrap">
                        {acc.name}
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-3 text-[#5C6E6E] whitespace-nowrap">
                        {acc.profile?.name || 'N/A'}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                          acc.type === 'main' ? 'bg-[#0E3D40]/10 text-[#0E3D40]' : 'bg-[#2BB673]/10 text-[#2BB673]'
                        )}>
                          {acc.type}
                        </span>
                      </td>

                      {/* Kingdom Badge */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {acc.kingdom && typeof acc.kingdom === 'object' ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-sm"
                            style={{
                              borderColor: acc.kingdom.color_hex,
                              color: acc.kingdom.color_hex,
                              backgroundColor: `${acc.kingdom.color_hex}10`
                            }}
                          >
                            {acc.kingdom.name}
                          </span>
                        ) : acc.kingdom ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-black/20 text-black/70 bg-black/5">
                            {acc.kingdom as string}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">N/A</span>
                        )}
                      </td>

                      {/* TP / SH Levels */}
                      <td className="py-3 px-3 text-center text-[#5C6E6E] font-medium font-mono whitespace-nowrap">
                        {acc.trading_post_level}/{acc.storehouse_level}
                      </td>

                      {/* Resource Stocks Cells */}
                      {RESOURCES.map(res => {
                        const cellKey = `${acc.id}-${res}`;
                        const qty = acc.resource_stock?.[res] ?? 0;
                        const isEditing = editingCell?.accId === acc.id && editingCell?.resource === res;
                        const isSaving = savingCells[cellKey];
                        const isSuccess = successCells[cellKey];

                        return (
                          <td
                            key={res}
                            onClick={() => !isEditing && startEditing(acc.id, res, qty)}
                            className={cn(
                              "py-3 px-3 text-right font-mono font-medium relative transition-all duration-150 whitespace-nowrap",
                              hasWriteAccess ? "cursor-pointer hover:bg-black/5" : "text-[#6B8079]/70"
                            )}
                          >
                            <div className="flex items-center justify-end gap-1.5 min-h-[24px]">
                              {isSaving && (
                                <Loader2 className="w-3 h-3 animate-spin text-[#2BB673]" />
                              )}

                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={formatInput(editValue)}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveEdit(acc.id, res);
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    className={cn(
                                      "w-20 text-right text-xs py-0.5 px-1 border rounded shadow-inner outline-none bg-white font-bold font-mono",
                                      RESOURCE_BORDER[res]
                                    )}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(acc.id, res)}
                                    className="p-0.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 rounded border border-emerald-300 shrink-0"
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCell(null)}
                                    className="p-0.5 text-red-600 hover:text-red-800 bg-red-50 rounded border border-red-300 shrink-0"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className={cn(
                                  "inline-flex items-center gap-1 transition-colors",
                                  qty > 0 ? "text-[#0E3D40] font-bold" : "text-[#6B8079]/30",
                                  isSuccess ? "bg-green-100 text-green-800 rounded px-1 scale-105" : ""
                                )}>
                                  <span>{qty > 0 ? fmt(qty) : '0'}</span>
                                  {hasWriteAccess && (
                                    <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 text-[#0E3D40] transition-opacity shrink-0" />
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Table Footer */}
            {filteredAccounts.length > 0 && (
              <tfoot>
                <tr className="bg-[#FAF5EA]/55 font-bold border-t-2 border-[#E8DDC9] text-[#0E3D40]">
                  <td colSpan={5} className="py-3.5 px-4 text-left font-bold uppercase tracking-wider text-[10px]">
                    Total Stok Terfilter
                  </td>
                  {RESOURCES.map(res => (
                    <td key={res} className="py-3.5 px-3 text-right font-mono font-black text-sm whitespace-nowrap">
                      {fmt(totals.sums[res])}
                    </td>
                  ))}

                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
