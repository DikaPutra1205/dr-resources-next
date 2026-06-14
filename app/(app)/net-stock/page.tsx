'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, Profile, ResourceType } from '@/lib/types';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, TRADING_POST_CONFIG, STOREHOUSE_CONFIG, cn, fmt } from '@/lib/utils';
import { Loader2, Users, Database } from 'lucide-react';

interface AggregatedStock {
  food: { gross: number; net: number };
  wood: { gross: number; net: number };
  stone: { gross: number; net: number };
  gold: { gross: number; net: number };
}

export default function NetStockPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [editingCell, setEditingCell] = useState<{accId: number, res: string} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [pRes, aRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('game_accounts').select('*, resource_stock:resource_stocks(*), kingdom:kingdoms(*)')
    ]);
    if (pRes.data) setUsers(pRes.data);
    if (aRes.data) setAccounts(aRes.data as any);
    setLoading(false);
  }

  // Calculate user-level aggregation
  const groupedAccounts = useMemo(() => {
    return accounts.reduce((acc, current) => {
      const ownerId = current.user_id;
      if (!acc[ownerId]) acc[ownerId] = [];
      acc[ownerId].push(current);
      return acc;
    }, {} as Record<string, typeof accounts>);
  }, [accounts]);

  async function handleSaveEdit(accId: number, res: string) {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const numValue = parseInt(editValue.replace(/,/g, ''), 10) || 0;
      const val = Math.max(0, numValue);
      
      const { error } = await supabase
        .from('resource_stocks')
        .update({ [res]: val })
        .eq('game_account_id', accId);
        
      if (error) throw error;
      
      // Update local state
      setAccounts(prev => prev.map(a => {
        if (a.id === accId) {
          return {
            ...a,
            resource_stock: { ...(a.resource_stock || {}), [res]: val }
          };
        }
        return a;
      }));
      setEditingCell(null);
    } catch (err: any) {
      alert('Gagal update stok: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  function startEditing(accId: number, res: string, currentVal: number) {
    setEditingCell({ accId, res });
    setEditValue(currentVal.toString());
  }

  const userData = users.map(user => {
    const userAccs = groupedAccounts[user.id] || [];
    const total = {
      food: { gross: 0, net: 0 },
      wood: { gross: 0, net: 0 },
      stone: { gross: 0, net: 0 },
      gold: { gross: 0, net: 0 },
    };

    userAccs.forEach((acc: any) => {
      const tp = TRADING_POST_CONFIG[acc.trading_post_level];
      const sh = STOREHOUSE_CONFIG[acc.storehouse_level];
      const tax = tp?.tax_rate ?? 0;

      RESOURCES.forEach(res => {
        const stock = acc.resource_stock?.[res] ?? 0;
        const prot = sh?.[res] ?? 0;
        const sendableGross = Math.max(0, stock - prot);
        const sendableNet = Math.floor(sendableGross / (1 + tax));

        total[res].gross += sendableGross;
        total[res].net += sendableNet;
      });
    });

    return { user, accounts: userAccs, total };
  }).filter(d => d.accounts.length > 0); // Only show users who have accounts

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Net Stock Anggota</h1>
        <p className="text-sm text-[#6B8079] mt-1">Daftar stok bersih (net) gabungan dari semua akun yang dimiliki oleh masing-masing anggota.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Anggota</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></div>
                      {RESOURCE_LABELS[res]} (Net)
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {userData.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-[#6B8079]">Belum ada data stok.</td></tr>
              ) : userData.map(row => (
                <tr key={row.user.id} className="hover:bg-[#FAF5EA]/50 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0E3D40]/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#0E3D40]" />
                      </div>
                      <div>
                        <div className="font-bold text-[#0E3D40]">{row.user.name}</div>
                        <div className="text-[10px] text-[#6B8079] mt-0.5">{row.accounts.length} Akun Game</div>
                      </div>
                    </div>
                  </td>
                  {RESOURCES.map(res => (
                    <td key={res} className="py-4 px-4 text-right">
                      <div className="font-mono text-sm font-bold text-[#0E3D40]">
                        {row.total[res].net > 0 ? fmt(row.total[res].net) : '-'}
                      </div>
                      {row.total[res].gross > 0 && (
                        <div className="text-[10px] text-[#6B8079]/70 font-mono mt-0.5">
                          Gross: {fmt(row.total[res].gross)}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
