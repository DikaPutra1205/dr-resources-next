'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ResourceType } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, TRADING_POST_CONFIG, STOREHOUSE_CONFIG, cn, fmt } from '@/lib/utils';
import { Loader2, Users, Shield, ChevronDown, ChevronRight } from 'lucide-react';

export default function NetStockPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKingdomKey, setActiveKingdomKey] = useState<string | null>(null);
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(new Set());

  const [globalPrices, setGlobalPrices] = useState<Record<ResourceType, number>>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [kingdomPrices, setKingdomPrices] = useState<Record<number, Record<ResourceType, number>>>({});

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('netstock-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_stocks' }, (payload) => {
        const s = payload.new as any;
        setAccounts(prev => prev.map(a =>
          a.id === s.game_account_id ? { ...a, resource_stock: { ...(a.resource_stock || {}), ...s } } : a
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    setLoading(true);
    const [aRes, prRes] = await Promise.all([
      supabase.from('game_accounts').select('*, resource_stock:resource_stocks(*), kingdom:kingdoms(*), profile:profiles(*)'),
      supabase.from('resource_prices').select('*')
    ]);

    if (aRes.data) setAccounts(aRes.data as any);

    const gPrices = { food: 0, wood: 0, stone: 0, gold: 0 } as Record<ResourceType, number>;
    const kPrices = {} as Record<number, Record<ResourceType, number>>;
    const pricesList = prRes.data || [];
    pricesList.forEach(p => { if (p.kingdom_id === null) gPrices[p.resource as ResourceType] = Number(p.price_per_million); });
    const kingdomIds = new Set((aRes.data || []).map((a: any) => a.kingdom_id).filter(Boolean));
    kingdomIds.forEach(kid => { kPrices[kid as number] = { ...gPrices }; });
    pricesList.forEach(p => {
      if (p.kingdom_id !== null) {
        if (!kPrices[p.kingdom_id]) kPrices[p.kingdom_id] = { ...gPrices };
        kPrices[p.kingdom_id][p.resource as ResourceType] = Number(p.price_per_million);
      }
    });

    setGlobalPrices(gPrices);
    setKingdomPrices(kPrices);
    setLoading(false);
  }

  function getPrice(kingdomId: number | null, resource: ResourceType): number {
    if (kingdomId && kingdomPrices[kingdomId]) return kingdomPrices[kingdomId][resource];
    return globalPrices[resource];
  }

  function calcSendable(acc: any, res: ResourceType) {
    const tp = TRADING_POST_CONFIG[acc.trading_post_level];
    const sh = STOREHOUSE_CONFIG[acc.storehouse_level];
    const tax = tp?.tax_rate ?? 0;
    const stock = acc.resource_stock?.[res] ?? 0;
    const prot = sh?.[res] ?? 0;
    const gross = Math.max(0, stock - prot);
    const net = Math.floor(Math.floor(gross / (1 + tax)) / 1_000_000) * 1_000_000;
    return { stock, gross, net };
  }

  // Build kingdom groups
  const kingdomGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; kingdomId: number | null; accounts: any[] }>();
    accounts.forEach(acc => {
      const key = String(acc.kingdom?.id ?? 'none');
      if (!map.has(key)) map.set(key, { key, label: acc.kingdom?.name ?? 'Tanpa Kingdom', kingdomId: acc.kingdom?.id ?? null, accounts: [] });
      map.get(key)!.accounts.push(acc);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [accounts]);

  // Set default tab
  useEffect(() => {
    if (kingdomGroups.length > 0 && activeKingdomKey === null) {
      setActiveKingdomKey(kingdomGroups[0].key);
    }
  }, [kingdomGroups]);

  const activeGroup = kingdomGroups.find(g => g.key === activeKingdomKey) ?? null;

  // Build owner map for active kingdom
  const ownerMap = useMemo(() => {
    if (!activeGroup) return new Map<string, { label: string; accounts: any[] }>();
    const map = new Map<string, { label: string; accounts: any[] }>();
    activeGroup.accounts.forEach(acc => {
      const uid = acc.user_id;
      const uName = acc.profile?.name ?? 'N/A';
      if (!map.has(uid)) map.set(uid, { label: uName, accounts: [] });
      map.get(uid)!.accounts.push(acc);
    });
    return map;
  }, [activeGroup]);

  // Kingdom totals for active tab
  const kingdomTotals = useMemo(() => {
    if (!activeGroup) return { net: { food: 0, wood: 0, stone: 0, gold: 0 }, value: 0 };
    const net = { food: 0, wood: 0, stone: 0, gold: 0 };
    let value = 0;
    activeGroup.accounts.forEach(acc => {
      RESOURCES.forEach(res => {
        const { net: n } = calcSendable(acc, res);
        net[res] += n;
        value += (n * getPrice(acc.kingdom_id, res)) / 1_000_000;
      });
    });
    return { net, value };
  }, [activeGroup, globalPrices, kingdomPrices]);

  // Global totals (summary cards)
  const globalTotals = useMemo(() => {
    const net = { food: 0, wood: 0, stone: 0, gold: 0 };
    let grandTotal = 0;
    accounts.forEach(acc => {
      RESOURCES.forEach(res => {
        const { net: n } = calcSendable(acc, res);
        net[res] += n;
        grandTotal += (n * getPrice(acc.kingdom_id, res)) / 1_000_000;
      });
    });
    return { net, grandTotal };
  }, [accounts, globalPrices, kingdomPrices]);

  function toggleOwner(key: string) {
    setCollapsedOwners(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Net Stock Anggota</h1>
        <p className="text-sm text-[#6B8079] mt-1">Stok bersih yang dapat dikirim per kingdom.</p>
      </div>

      {/* Global Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {RESOURCES.map(res => (
          <div key={res} className="card p-4 flex flex-col justify-between space-y-2 border-l-4"
            style={{ borderLeftColor: res === 'food' ? '#10B981' : res === 'wood' ? '#F59E0B' : res === 'stone' ? '#64748B' : '#EAB308' }}>
            <div>
              <span className="block text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])} />
                Net {RESOURCE_LABELS[res]}
              </span>
              <span className="text-base font-black text-[#0E3D40] block font-mono mt-1">{fmt(globalTotals.net[res])}</span>
            </div>
          </div>
        ))}
        <div className="col-span-2 lg:col-span-1 bg-[#2BB673]/10 p-4 rounded-2xl border border-[#2BB673]/30 flex flex-col justify-between shadow-sm">
          <span className="block text-[10px] font-bold text-[#0E3D40] uppercase tracking-wider">TOTAL NILAI NET</span>
          <span className="text-lg font-black text-[#0E3D40] block mt-1">Rp {fmt(globalTotals.grandTotal)}</span>
          <span className="text-[9px] text-[#5C6E6E] font-medium block">Semua kingdom</span>
        </div>
      </div>

      {/* Kingdom Tabs */}
      <div className="card overflow-hidden">
        {/* Tab Bar */}
        <div className="flex overflow-x-auto border-b border-[#E8DDC9] bg-[#FAF5EA]">
          {kingdomGroups.map(group => (
            <button
              key={group.key}
              onClick={() => setActiveKingdomKey(group.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all shrink-0",
                activeKingdomKey === group.key
                  ? "border-[#2BB673] text-[#0E3D40] bg-white"
                  : "border-transparent text-[#6B8079] hover:text-[#0E3D40] hover:bg-[#FAF5EA]/80"
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              {group.label}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                activeKingdomKey === group.key ? "bg-[#2BB673]/15 text-[#2BB673]" : "bg-[#E8DDC9] text-[#6B8079]"
              )}>
                {group.accounts.length}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeGroup && (
          <div>
            {/* Kingdom Subtotal Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 border-b border-[#E8DDC9] bg-[#0E3D40]/3">
              {RESOURCES.map(res => (
                <div key={res} className="px-4 py-3 border-r border-[#E8DDC9]/50 last:border-r-0">
                  <div className="text-[9px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-1 mb-0.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[res])} />{RESOURCE_LABELS[res]}
                  </div>
                  <div className="font-black text-[#0E3D40] font-mono text-sm">{kingdomTotals.net[res] > 0 ? fmt(kingdomTotals.net[res]) : '-'}</div>
                </div>
              ))}
              <div className="px-4 py-3">
                <div className="text-[9px] font-bold text-[#5C6E6E] uppercase tracking-wider mb-0.5">Nilai Kingdom</div>
                <div className="font-black text-[#2BB673] font-mono text-sm">Rp {fmt(kingdomTotals.value)}</div>
              </div>
            </div>

            {/* Owner & Account List */}
            <div className="flex flex-col gap-3 p-3">
              {Array.from(ownerMap.entries()).map(([userId, { label: ownerName, accounts: ownerAccs }]) => {
                const isCollapsed = collapsedOwners.has(userId);

                // Owner totals
                const ownerNet = { food: 0, wood: 0, stone: 0, gold: 0 };
                let ownerValue = 0;
                ownerAccs.forEach(acc => {
                  RESOURCES.forEach(res => {
                    const { net } = calcSendable(acc, res);
                    ownerNet[res] += net;
                    ownerValue += (net * getPrice(acc.kingdom_id, res)) / 1_000_000;
                  });
                });

                return (
                  <div key={userId} className="rounded-xl border border-[#E8DDC9] overflow-hidden shadow-sm">
                    {/* Owner Header (collapsible) */}
                    <button
                      type="button"
                      onClick={() => toggleOwner(userId)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0E3D40] hover:bg-[#0E3D40]/90 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm">{ownerName}</div>
                        <div className="text-[10px] text-white/60">{ownerAccs.length} akun · Rp {fmt(ownerValue)}</div>
                      </div>
                      {/* Owner totals inline */}
                      <div className="hidden sm:flex items-center gap-4 mr-3">
                        {RESOURCES.map(res => ownerNet[res] > 0 ? (
                          <div key={res} className="text-right">
                            <div className={cn("text-[8px] font-bold uppercase text-white/50")}>{RESOURCE_LABELS[res]}</div>
                            <div className="text-xs font-mono font-bold text-white">{fmt(ownerNet[res])}</div>
                          </div>
                        ) : null)}
                      </div>
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-white/60 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/60 shrink-0" />}
                    </button>

                    {/* Individual Game Accounts */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#FAF5EA] text-[#6B8079] text-[10px] uppercase tracking-wider border-b border-[#E8DDC9]">
                              <th className="py-2 px-4 pl-12">Akun</th>
                              <th className="py-2 px-3 text-center">TP/SH</th>
                              {RESOURCES.map(res => (
                                <th key={res} className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", RESOURCE_DOT[res])} />
                                    {RESOURCE_LABELS[res]}
                                  </div>
                                </th>
                              ))}
                              <th className="py-2 px-3 text-right">Nilai</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8DDC9]/30">
                            {ownerAccs.map(acc => {
                              let accValue = 0;
                              const accNets = {} as Record<ResourceType, number>;
                              RESOURCES.forEach(res => {
                                const { net } = calcSendable(acc, res);
                                accNets[res] = net;
                                accValue += (net * getPrice(acc.kingdom_id, res)) / 1_000_000;
                              });

                              return (
                                <tr key={acc.id} className="bg-white hover:bg-[#F7FBF9] transition-colors border-b border-[#E8DDC9]/40 last:border-0">
                                  <td className="py-2.5 px-4 pl-12">
                                    <div className="font-semibold text-[#0E3D40]">{acc.name}</div>
                                    <span className={cn("text-[8px] px-1 py-0.5 rounded uppercase tracking-wider border",
                                      acc.type === 'main' ? "bg-[#0E3D40]/5 border-[#0E3D40]/20 text-[#0E3D40]" : "bg-[#6B8079]/5 border-[#6B8079]/20 text-[#6B8079]"
                                    )}>{acc.type}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono text-[#6B8079]">
                                    {acc.trading_post_level}/{acc.storehouse_level}
                                  </td>
                                  {RESOURCES.map(res => (
                                    <td key={res} className="py-2.5 px-3 text-right font-mono">
                                      {accNets[res] > 0
                                        ? <span className="font-semibold text-[#0E3D40]">{fmt(accNets[res])}</span>
                                        : <span className="text-[#6B8079]/30">-</span>
                                      }
                                    </td>
                                  ))}
                                  <td className="py-2.5 px-3 text-right font-mono text-[#6B8079] text-[11px]">
                                    {accValue > 0 ? `Rp ${fmt(accValue)}` : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Owner subtotal row */}
                            <tr className="bg-[#0E3D40]/5 border-t border-[#0E3D40]/10 font-bold">
                               <td className="py-2 px-4 pl-12 text-[10px] text-[#0E3D40]/60 uppercase tracking-wider" colSpan={2}>
                                 Subtotal
                               </td>
                               {RESOURCES.map(res => (
                                 <td key={res} className="py-2 px-3 text-right font-mono font-bold text-[#0E3D40] text-xs">
                                   {ownerNet[res] > 0 ? fmt(ownerNet[res]) : '-'}
                                 </td>
                               ))}
                               <td className="py-2 px-3 text-right font-mono font-bold text-[#2BB673] text-xs">
                                 Rp {fmt(ownerValue)}
                               </td>
                             </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
