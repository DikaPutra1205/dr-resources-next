'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { log } from '@/lib/logger';
import { Kingdom, Profile } from '@/lib/types';
import { Loader2, Save, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommissionsPage() {
  const supabase = createClient();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // formData: { [kingdomKey]: { [userId]: rate_string } }
  // kingdomKey = 'global' | kingdom_id.toString()
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [kRes, pRes, rRes] = await Promise.all([
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('profiles').select('*').eq('role', 'admin').order('name'),
      supabase.from('kingdom_commission_rates').select('*'),
    ]);

    const ks = kRes.data || [];
    const admins = pRes.data || [];
    const rates = rRes.data || [];
    setKingdoms(ks);
    setAdmins(admins);

    // Build form state
    const initial: Record<string, Record<string, string>> = {};
    initial['global'] = {};
    admins.forEach(a => { initial['global'][a.id] = ''; });
    ks.forEach(k => {
      initial[k.id.toString()] = {};
      admins.forEach(a => { initial[k.id.toString()][a.id] = ''; });
    });

    rates.forEach(r => {
      const key = r.kingdom_id ? r.kingdom_id.toString() : 'global';
      if (initial[key]) initial[key][r.user_id] = r.rate.toString();
    });

    setFormData(initial);
    setLoading(false);
  }

  function handleInput(kingdomKey: string, userId: string, val: string) {
    setFormData(prev => ({
      ...prev,
      [kingdomKey]: { ...prev[kingdomKey], [userId]: val }
    }));
  }

  async function handleSave() {
    setSaving(true);
    const upserts: any[] = [];

    // Global
    admins.forEach(a => {
      const val = formData['global']?.[a.id];
      if (val !== undefined && val !== '') {
        upserts.push({ kingdom_id: null, user_id: a.id, rate: parseInt(val) || 0 });
      }
    });

    // Per kingdom
    kingdoms.forEach(k => {
      const key = k.id.toString();
      admins.forEach(a => {
        const val = formData[key]?.[a.id];
        if (val !== undefined && val !== '') {
          upserts.push({ kingdom_id: k.id, user_id: a.id, rate: parseInt(val) || 0 });
        }
      });
    });

    const { error } = await supabase
      .from('kingdom_commission_rates')
      .upsert(upserts, { onConflict: 'kingdom_id,user_id' });

    setSaving(false);
    if (!error) {
      await log('commission.update', { kingdom_count: kingdoms.length, admin_count: admins.length });
      alert('Komisi berhasil disimpan!');
    } else {
      alert('Gagal menyimpan: ' + error.message);
    }
    fetchData();
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Komisi Pengurus</h1>
          <p className="text-sm text-[#6B8079] mt-1">
            Atur komisi per pengurus per kingdom (Rp/juta total resource). Kosong = pakai global default.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] text-[#5C6E6E] text-[10px] uppercase tracking-wider">
                <th className="py-3 px-5 font-bold w-40">Kingdom</th>
                {admins.map(a => (
                  <th key={a.id} className="py-3 px-4 text-right font-bold">
                    <div className="flex items-center justify-end gap-1.5">
                      <Shield className="w-3 h-3" />
                      {a.name}
                    </div>
                    <div className="text-[9px] font-normal opacity-60 mt-0.5">Rp/juta</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {/* Global row */}
              <tr className="bg-[#0E3D40]/5">
                <td className="py-4 px-5">
                  <div className="font-bold text-[#0E3D40]">🌍 Global Default</div>
                  <div className="text-[10px] text-[#6B8079] mt-0.5">Dipakai jika kingdom tidak memiliki rate tersendiri</div>
                </td>
                {admins.map(a => (
                  <td key={a.id} className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-[#6B8079] text-xs mr-2">Rp</span>
                      <input
                        type="number" min="0"
                        value={formData['global']?.[a.id] || ''}
                        onChange={e => handleInput('global', a.id, e.target.value)}
                        className="w-20 text-right font-mono text-sm py-1.5 px-2 border border-[#E8DDC9] focus:border-[#2BB673] rounded shadow-inner outline-none bg-white font-semibold text-[#0E3D40]"
                      />
                    </div>
                  </td>
                ))}
              </tr>

              {/* Kingdom rows */}
              {kingdoms.map(k => (
                <tr key={k.id} className="hover:bg-[#FAF5EA]/50 transition-colors">
                  <td className="py-3 px-5">
                    <span className="font-bold px-2.5 py-1 rounded-full border text-xs inline-block"
                      style={{ borderColor: k.color_hex, color: k.color_hex, backgroundColor: `${k.color_hex}10` }}>
                      {k.name}
                    </span>
                  </td>
                  {admins.map(a => {
                    const val = formData[k.id.toString()]?.[a.id];
                    const hasOverride = val !== undefined && val !== '';
                    const globalVal = formData['global']?.[a.id];
                    return (
                      <td key={a.id} className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <span className={cn('text-xs mr-2', hasOverride ? 'text-[#0E3D40] font-semibold' : 'text-[#6B8079]/50')}>Rp</span>
                          <input
                            type="number" min="0"
                            placeholder={globalVal || '0'}
                            value={val || ''}
                            onChange={e => handleInput(k.id.toString(), a.id, e.target.value)}
                            className={cn(
                              'w-20 text-right font-mono text-sm py-1 px-2 border rounded outline-none transition-colors',
                              hasOverride
                                ? 'border-[#2BB673] bg-[#2BB673]/5 text-[#0E3D40] font-semibold shadow-inner'
                                : 'border-transparent bg-transparent text-[#6B8079] focus:border-[#E8DDC9] focus:bg-white focus:shadow-inner'
                            )}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
