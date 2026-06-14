'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Kingdom, Profile, ResourceType } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, TRADING_POST_CONFIG, STOREHOUSE_CONFIG, cn, fmt } from '@/lib/utils';
import { Loader2, Users, Shield } from 'lucide-react';

interface KingdomGroup {
  kingdom: Kingdom | null;
  accounts: any[];
}

export default function NetStockPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Price state
  const [globalPrices, setGlobalPrices] = useState<Record<ResourceType, number>>({ food: 0, wood: 0, stone: 0, gold: 0 });
  const [kingdomPrices, setKingdomPrices] = useState<Record<number, Record<ResourceType, number>>>({});

  useEffect(() => {
    fetchData();
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

    pricesList.forEach(p => {
      if (p.kingdom_id === null) {
        gPrices[p.resource as ResourceType] = Number(p.price_per_million);
      }
    });

    const kingdomIds = new Set((aRes.data || []).map((a: any) => a.kingdom_id).filter(Boolean));
    kingdomIds.forEach(kid => {
      kPrices[kid as number] = { ...gPrices };
    });

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

  function getPrice(kingdomId: number | null, resource: ResourceType): number {
    if (kingdomId && kingdomPrices[kingdomId]) {
      return kingdomPrices[kingdomId][resource];
    }
    return globalPrices[resource];
  }

  function floorToMillion(n: number) {
    return Math.floor(n / 1_000_000) * 1_000_000;
  }

  function calcSendable(acc: any, res: ResourceType) {
    const tp = TRADING_POST_CONFIG[acc.trading_post_level];
    const sh = STOREHOUSE_CONFIG[acc.storehouse_level];
    const tax = tp?.tax_rate ?? 0;
    const stock = acc.resource_stock?.[res] ?? 0;
    const prot = sh?.[res] ?? 0;
    const gross = Math.max(0, stock - prot);
    const net = floorToMillion(Math.floor(gross / (1 + tax)));
    return { gross, net };
  }

  const kingdomGroups = useMemo(() => {
    const map = new Map<string, KingdomGroup>();
    accounts.forEach(acc => {
      const key = acc.kingdom?.id ?? 'no-kingdom';
      if (!map.has(key)) {
        map.set(key, { kingdom: acc.kingdom || null, accounts: [] });
      }
      map.get(key)!.accounts.push(acc);
    });
    return Array.from(map.values()).sort((a, b) => {
      const an = a.kingdom?.name || '';
      const bn = b.kingdom?.name || '';
      return an.localeCompare(bn);
    });
  }, [accounts]);

  const globalTotals = useMemo(() => {
    const net = { food: 0, wood: 0, stone: 0, gold: 0 };
    const value = { food: 0, wood: 0, stone: 0, gold: 0 };
    accounts.forEach(acc => {
      RESOURCES.forEach(res => {
        const { net: n } = calcSendable(acc, res);
        net[res] += n;
        value[res] += (n * getPrice(acc.kingdom_id, res)) / 1000000;
      });
    });
    const grandTotal = value.food + value.wood + value.stone + value.gold;
    return { net, value, grandTotal };
  }, [accounts, globalPrices, kingdomPrices]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Net Stock Anggota</h1>
        <p className="text-sm text-[#6B8079] mt-1">Daftar stok bersih (net) gabungan dari semua akun yang dimiliki oleh masing-masing anggota.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {RESOURCES.map(res => (
          <div key={res} className="card p-4 flex flex-col justify-between space-y-2 border-l-4" style={{ borderLeftColor: res === 'food' ? '#10B981' : res === 'wood' ? '#F59E0B' : res === 'stone' ? '#64748B' : '#F59E0B' }}>
            <div>
              <span className="block text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></span>
                Net {RESOURCE_LABELS[res]}
              </span>
              <span className="text-base font-black text-[#0E3D40] block font-mono mt-1">
                {fmt(globalTotals.net[res])}
              </span>
            </div>
            <span className="text-xs text-[#5C6E6E] font-semibold block">
              Rp {fmt(globalTotals.value[res])}
            </span>
          </div>
        ))}
        <div className="col-span-2 lg:col-span-1 bg-[#2BB673]/10 p-4 rounded-2xl border border-[#2BB673]/30 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <Users className="w-24 h-24 text-[#0E3D40]" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-[#0E3D40] uppercase tracking-wider">TOTAL NILAI NET</span>
            <span className="text-lg font-black text-[#0E3D40] block mt-1">
              Rp {fmt(globalTotals.grandTotal)}
            </span>
          </div>
          <span className="text-[9px] text-[#5C6E6E] font-medium block">
            Gabungan nilai pasar semua resource (net)
          </span>
        </div>
      </div>

      {/* Kingdom Grouped Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Kingdom / Anggota</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></div>
                      {RESOURCE_LABELS[res]} (Net)
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Estimasi Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {kingdomGroups.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[#6B8079]">Belum ada data stok.</td></tr>
              ) : kingdomGroups.flatMap(group => {
                // Build user map within this kingdom
                const userMap = new Map<string, { user: Profile | null; accounts: any[] }>();
                group.accounts.forEach(acc => {
                  const uid = acc.user_id;
                  if (!userMap.has(uid)) {
                    userMap.set(uid, { user: acc.profile || null, accounts: [] });
                  }
                  userMap.get(uid)!.accounts.push(acc);
                });

                // Calculate kingdom totals
                const kNet = { food: 0, wood: 0, stone: 0, gold: 0 };
                let kValue = 0;
                group.accounts.forEach(acc => {
                  RESOURCES.forEach(res => {
                    const { net } = calcSendable(acc, res);
                    kNet[res] += net;
                    kValue += (net * getPrice(acc.kingdom_id, res)) / 1000000;
                  });
                });

                const rows: any[] = [];

                // Kingdom header row
                rows.push(
                  <tr key={`k-${group.kingdom?.id ?? 'none'}`} className="bg-[#FAF5EA]/60">
                    <td className="py-4 px-4 col-span-full" colSpan={6}>
                      <div className="flex items-center gap-2 font-bold text-[#0E3D40]">
                        <Shield className="w-4 h-4" />
                        Kingdom {group.kingdom?.name || 'Tanpa Kingdom'}
                        <span className="text-[10px] font-normal text-[#6B8079] ml-2">
                          {group.accounts.length} Akun &middot; {userMap.size} Anggota
                        </span>
                      </div>
                    </td>
                  </tr>
                );

                // Kingdom summary row
                rows.push(
                  <tr key={`ks-${group.kingdom?.id ?? 'none'}`} className="bg-[#FAF5EA]/30 border-b border-[#E8DDC9]/70">
                    <td className="py-2.5 px-4 text-[10px] font-bold text-[#5C6E6E] uppercase tracking-wider">Subtotal Kingdom</td>
                    {RESOURCES.map(res => (
                      <td key={res} className="py-2.5 px-4 text-right font-mono font-bold text-[#0E3D40] text-xs">
                        {kNet[res] > 0 ? fmt(kNet[res]) : '-'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-[#0E3D40] text-xs">
                      Rp {fmt(kValue)}
                    </td>
                  </tr>
                );

                // Per-user rows
                userMap.forEach((entry, userId) => {
                  const userNet = { food: 0, wood: 0, stone: 0, gold: 0 };
                  let userValue = 0;
                  entry.accounts.forEach((acc: any) => {
                    RESOURCES.forEach(res => {
                      const { net } = calcSendable(acc, res);
                      userNet[res] += net;
                      userValue += (net * getPrice(acc.kingdom_id, res)) / 1000000;
                    });
                  });

                  rows.push(
                    <tr key={`u-${userId}`} className="hover:bg-[#FAF5EA]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-[#0E3D40]/8 flex items-center justify-center">
                            <Users className="w-3.5 h-3.5 text-[#0E3D40]" />
                          </div>
                          <div>
                            <div className="font-semibold text-[#0E3D40] text-sm">{entry.user?.name || 'N/A'}</div>
                            <div className="text-[10px] text-[#6B8079]">{entry.accounts.length} Akun</div>
                          </div>
                        </div>
                      </td>
                      {RESOURCES.map(res => (
                        <td key={res} className="py-3 px-4 text-right font-mono text-sm font-medium text-[#0E3D40]">
                          {userNet[res] > 0 ? fmt(userNet[res]) : '-'}
                        </td>
                      ))}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#0E3D40]">
                        Rp {fmt(userValue)}
                      </td>
                    </tr>
                  );
                });

                return rows;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
