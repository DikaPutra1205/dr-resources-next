'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, Kingdom, Profile, ResourceType } from '@/lib/types';
import {
  RESOURCES,
  RESOURCE_LABELS,
  RESOURCE_DOT,
  RESOURCE_BORDER,
  fmt,
  parseShorthand,
  formatInput,
  getSendable,
  cn,
  getRokDailyCycle,
  isDailyCompleted,
  formatDailyCompletedTime,
} from '@/lib/utils';
import {
  Loader2,
  Gamepad2,
  Search,
  ArrowLeftRight,
  HelpCircle,
  Check,
  Shield,
  Edit3,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  CheckCheck,
  RotateCcw,
  CalendarCheck,
} from 'lucide-react';
import Link from 'next/link';
import { log } from '@/lib/logger';

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  // Core Data
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);

  // Pricing state
  const [globalPrices, setGlobalPrices] = useState<Record<ResourceType, number>>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [kingdomPrices, setKingdomPrices] = useState<Record<number, Record<ResourceType, number>>>({});

  // Auth Info
  const [userId, setUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Clock tick for live countdown and cycle checking
  const [now, setNow] = useState<Date>(new Date());

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKingdom, setActiveKingdom] = useState<string>('all');
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [dailyFilter, setDailyFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Inline Editing State
  const [editingCell, setEditingCell] = useState<{ accId: number; resource: ResourceType } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
  const [successCells, setSuccessCells] = useState<Record<string, boolean>>({});

  // Daily Quest Action State
  const [savingDaily, setSavingDaily] = useState<Record<number, boolean>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();

    // Real-time subscriptions for stock and account updates
    const channel = supabase
      .channel('dashboard-realtime-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'resource_stocks' },
        (payload) => {
          const newStock = payload.new as any;
          if (!newStock?.game_account_id) return;
          setAccounts(prev => prev.map(a =>
            a.id === newStock.game_account_id
              ? { ...a, resource_stock: a.resource_stock ? { ...a.resource_stock, ...newStock } : newStock }
              : a
          ));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_accounts' },
        (payload) => {
          const newAcc = payload.new as any;
          if (!newAcc?.id) return;
          setAccounts(prev => prev.map(a =>
            a.id === newAcc.id
              ? {
                  ...a,
                  ...newAcc,
                  kingdom: a.kingdom,
                  profile: a.profile,
                  resource_stock: a.resource_stock,
                }
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

    if (accRes.data) {
      const normalized = accRes.data.map((a: any) => ({
        ...a,
        resource_stock: Array.isArray(a.resource_stock) ? a.resource_stock[0] : a.resource_stock,
      }));
      setAccounts(normalized);
    }
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

  // Rise of Kingdoms Daily Cycle Info
  const rokCycle = useMemo(() => getRokDailyCycle(now), [now]);

  // Dynamically extract active kingdoms for navigation tabs
  const kingdomTabs = useMemo(() => {
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

  // Base scope accounts for user/admin (before daily/kingdom filters)
  const baseScopeAccounts = useMemo(() => {
    let list = [...accounts];
    if (!isAdmin) {
      list = list.filter(acc => acc.user_id === userId);
    }
    if (filterUserId) {
      list = list.filter(acc => acc.user_id === filterUserId);
    }
    if (activeKingdom !== 'all') {
      list = list.filter(acc => getKingdomName(acc) === activeKingdom);
    }
    return list;
  }, [accounts, isAdmin, userId, filterUserId, activeKingdom]);

  // Daily statistics for the current scope
  const dailyStats = useMemo(() => {
    const total = baseScopeAccounts.length;
    const completed = baseScopeAccounts.filter(acc => isDailyCompleted(acc.daily_completed_at, now)).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, percentage };
  }, [baseScopeAccounts, now]);

  // Accounts owned by current user (or all if admin) that are eligible for bulk actions
  const myEditableAccounts = useMemo(() => {
    return baseScopeAccounts.filter(a => isAdmin || a.user_id === userId);
  }, [baseScopeAccounts, isAdmin, userId]);

  // Filters application
  const filteredAccounts = useMemo(() => {
    let list = [...baseScopeAccounts];

    // Filter by Daily Status
    if (dailyFilter === 'completed') {
      list = list.filter(acc => isDailyCompleted(acc.daily_completed_at, now));
    } else if (dailyFilter === 'pending') {
      list = list.filter(acc => !isDailyCompleted(acc.daily_completed_at, now));
    }

    // Filter by Search text
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(acc =>
        acc.name.toLowerCase().includes(q) ||
        (acc.profile?.name && acc.profile.name.toLowerCase().includes(q))
      );
    }

    // Order: Owner name ASC, Main first, Account name ASC
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
  }, [baseScopeAccounts, dailyFilter, searchQuery, now]);

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

    if (cleanValue === oldVal) {
      setEditingCell(null);
      return;
    }

    const cellKey = `${accId}-${resource}`;
    setSavingCells(prev => ({ ...prev, [cellKey]: true }));
    setEditingCell(null);

    try {
      const { error } = await supabase
        .from('resource_stocks')
        .update({ [resource]: cleanValue, updated_at: new Date().toISOString() })
        .eq('game_account_id', accId);

      if (error) throw error;

      setAccounts(prev => prev.map(a => {
        if (a.id === accId && a.resource_stock) {
          return {
            ...a,
            resource_stock: {
              ...a.resource_stock,
              [resource]: cleanValue
            }
          };
        }
        return a;
      }));

      log('stock.update', { game_account_id: accId, resource, old_value: oldVal, new_value: cleanValue });

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

  // Handle Single Daily Quest Toggle
  async function handleToggleDaily(accId: number, currentlyDone: boolean) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    const canEdit = isAdmin || acc.user_id === userId;
    if (!canEdit) return;

    const newTimestamp = currentlyDone ? null : new Date().toISOString();
    setSavingDaily(prev => ({ ...prev, [accId]: true }));

    // Optimistic UI Update
    setAccounts(prev => prev.map(a => a.id === accId ? { ...a, daily_completed_at: newTimestamp } : a));

    try {
      const { error } = await supabase
        .from('game_accounts')
        .update({ daily_completed_at: newTimestamp })
        .eq('id', accId);

      if (error) {
        // Revert on error
        setAccounts(prev => prev.map(a => a.id === accId ? { ...a, daily_completed_at: acc.daily_completed_at } : a));
        alert('Gagal mengupdate status daily quest: ' + error.message);
      } else {
        log('daily.toggle', { game_account_id: accId, completed: !currentlyDone, timestamp: newTimestamp });
      }
    } catch (err: any) {
      setAccounts(prev => prev.map(a => a.id === accId ? { ...a, daily_completed_at: acc.daily_completed_at } : a));
      alert('Gagal mengupdate status daily quest: ' + err.message);
    } finally {
      setSavingDaily(prev => ({ ...prev, [accId]: false }));
    }
  }

  // Handle Bulk Daily Quest Update
  async function handleBulkDaily(markDone: boolean) {
    if (myEditableAccounts.length === 0) return;
    const targetIds = myEditableAccounts.map(a => a.id);
    const newTimestamp = markDone ? new Date().toISOString() : null;

    setIsBulkSaving(true);
    // Optimistic Update
    setAccounts(prev => prev.map(a => targetIds.includes(a.id) ? { ...a, daily_completed_at: newTimestamp } : a));

    try {
      const { error } = await supabase
        .from('game_accounts')
        .update({ daily_completed_at: newTimestamp })
        .in('id', targetIds);

      if (error) {
        fetchData();
        alert('Gagal mengupdate massal daily quest: ' + error.message);
      } else {
        log('daily.bulk', { count: targetIds.length, markDone, timestamp: newTimestamp });
      }
    } catch (err: any) {
      fetchData();
      alert('Gagal mengupdate massal daily quest: ' + err.message);
    } finally {
      setIsBulkSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Ringkasan Dashboard</h1>
          <p className="text-sm text-[#6B8079] mt-1">Kelola stok dan pantau total kapasitas persediaan guild & daily quest secara real-time.</p>
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
                setActiveKingdom('all');
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

      {/* Daily Quest Highlight Banner */}
      <div className="bg-gradient-to-r from-[#0E3D40] via-[#134e4a] to-[#0E3D40] rounded-2xl p-5 text-white shadow-md border border-[#0E3D40]/40 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#2BB673]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 -top-10 w-32 h-32 bg-[#2BB673]/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left Column: Progress & Quest info */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#2BB673]/25 text-[#73f3b4] border border-[#2BB673]/40 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#73f3b4]" />
                Daily Quest Tracker
              </span>
              <span className="text-[11px] text-emerald-200/70 font-medium">
                Reset harian setiap 07:00 WIB (00:00 UTC)
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h3 className="text-xl font-black tracking-tight">
                {dailyStats.completed} <span className="text-sm font-semibold text-white/70">/ {dailyStats.total} Akun Selesai</span>
              </h3>
              <span className="text-sm font-bold text-[#73f3b4]">
                {dailyStats.percentage}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/15 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="bg-gradient-to-r from-[#2BB673] to-[#73f3b4] h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${dailyStats.percentage}%` }}
              />
            </div>
          </div>

          {/* Right Column: Live Countdown & Bulk Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6 bg-black/20 p-3.5 rounded-xl border border-white/10">
            {/* Countdown widget */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#73f3b4] shrink-0 border border-white/10">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">
                  Hitung Mundur Reset
                </span>
                <span className="font-mono text-base font-black text-white tracking-wide">
                  {rokCycle.formattedRemainingDetailed}
                </span>
              </div>
            </div>

            {/* Bulk Actions (Only for user/admin) */}
            {myEditableAccounts.length > 0 && (
              <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-4">
                <button
                  onClick={() => handleBulkDaily(true)}
                  disabled={isBulkSaving || dailyStats.pending === 0}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                    dailyStats.pending === 0
                      ? "bg-white/10 text-white/40 cursor-not-allowed"
                      : "bg-[#2BB673] hover:bg-[#23945d] text-white active:scale-95"
                  )}
                  title="Tandai semua akun yang belum selesai menjadi selesai"
                >
                  {isBulkSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Tandai Semua Selesai
                </button>

                {dailyStats.completed > 0 && (
                  <button
                    onClick={() => handleBulkDaily(false)}
                    disabled={isBulkSaving}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    title="Reset semua status daily menjadi belum"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kingdom Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DDC9]/60 pb-3">
        <div className="flex flex-wrap gap-2">
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

        {/* Daily Status Filter Chips */}
        <div className="flex items-center gap-1.5 bg-[#FAF5EA] p-1 rounded-xl border border-[#E8DDC9]">
          <span className="text-[10px] font-bold text-[#5C6E6E] px-2">Daily:</span>
          <button
            onClick={() => setDailyFilter('all')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
              dailyFilter === 'all'
                ? "bg-[#0E3D40] text-white shadow-sm"
                : "text-[#5C6E6E] hover:text-[#0E3D40]"
            )}
          >
            Semua ({dailyStats.total})
          </button>
          <button
            onClick={() => setDailyFilter('pending')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
              dailyFilter === 'pending'
                ? "bg-[#D9745A] text-white shadow-sm"
                : "text-[#D9745A] hover:bg-[#D9745A]/10"
            )}
          >
            <Circle className="w-3 h-3 stroke-[2.5]" />
            Belum ({dailyStats.pending})
          </button>
          <button
            onClick={() => setDailyFilter('completed')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
              dailyFilter === 'completed'
                ? "bg-[#2BB673] text-white shadow-sm"
                : "text-[#2BB673] hover:bg-[#2BB673]/10"
            )}
          >
            <Check className="w-3 h-3 stroke-[3]" />
            Selesai ({dailyStats.completed})
          </button>
        </div>
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
            <h3 className="text-sm font-bold text-[#0E3D40] uppercase tracking-wider">Stok Persediaan Akun Game & Daily</h3>
            <p className="text-xs text-[#6B8079] mt-0.5">Klik tombol Daily Quest untuk update status harian, atau klik angka stok untuk mengubah jumlah resource.</p>
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
                <th className="py-3.5 px-3 text-center w-[7%] min-w-[70px]">Tipe</th>
                <th className="py-3.5 px-3 text-center w-[8%] min-w-[90px]">Kingdom</th>
                <th className="py-3.5 px-3 text-center w-[7%] min-w-[75px]">TP/SH</th>
                <th className="py-3.5 px-3 text-center w-[11%] min-w-[115px]">Daily Quest</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3.5 px-3 text-right w-1/12 min-w-[95px]">{RESOURCE_LABELS[res]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-[#6B8079] font-medium">
                    Tidak ada akun game yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => {
                  const hasWriteAccess = isAdmin || acc.user_id === userId;
                  const isDone = isDailyCompleted(acc.daily_completed_at, now);
                  const isDailySaving = savingDaily[acc.id];
                  const completedTimeStr = isDone ? formatDailyCompletedTime(acc.daily_completed_at) : '';

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

                      {/* Daily Quest Interactive Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isDailySaving ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1 text-xs text-[#2BB673]">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span className="text-[10px] font-bold">Menyimpan...</span>
                          </div>
                        ) : isDone ? (
                          <button
                            type="button"
                            onClick={() => hasWriteAccess && handleToggleDaily(acc.id, true)}
                            disabled={!hasWriteAccess}
                            title={
                              hasWriteAccess
                                ? `Selesai ${completedTimeStr ? `pukul ${completedTimeStr}` : 'hari ini'}. Klik untuk batalkan.`
                                : `Selesai ${completedTimeStr ? `pukul ${completedTimeStr}` : 'hari ini'}`
                            }
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-150 border shadow-xs group/btn",
                              "bg-emerald-50 text-emerald-700 border-emerald-300",
                              hasWriteAccess
                                ? "hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer active:scale-95"
                                : "cursor-default opacity-85"
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
                            <span>Selesai</span>
                            {completedTimeStr && (
                              <span className="text-[9px] opacity-75 font-normal ml-0.5 font-mono">
                                {completedTimeStr.replace(' WIB', '')}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => hasWriteAccess && handleToggleDaily(acc.id, false)}
                            disabled={!hasWriteAccess}
                            title={
                              hasWriteAccess
                                ? "Belum dikerjakan. Klik jika sudah menyelesaikan Daily Quest."
                                : "Belum dikerjakan hari ini."
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-150 border",
                              "bg-amber-50/70 text-amber-800/80 border-amber-200/80",
                              hasWriteAccess
                                ? "hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300 cursor-pointer active:scale-95"
                                : "cursor-default opacity-75"
                            )}
                          >
                            <Circle className="w-3 h-3 text-amber-600/70 stroke-[2.5] shrink-0" />
                            <span>Belum</span>
                          </button>
                        )}
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
                  <td colSpan={6} className="py-3.5 px-4 text-left font-bold uppercase tracking-wider text-[10px]">
                    Total Stok Terfilter ({filteredAccounts.length} Akun)
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

