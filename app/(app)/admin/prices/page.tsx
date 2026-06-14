'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Kingdom, ResourcePrice, ResourceType } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_DOT, cn } from '@/lib/utils';

export default function ResourcePricesPage() {
  const supabase = createClient();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [prices, setPrices] = useState<ResourcePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state: { [kingdom_id_or_global]: { food: 0, wood: 0, ... } }
  // "global" is the key for kingdom_id = null
  const [formData, setFormData] = useState<Record<string, Record<ResourceType, string>>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [kRes, pRes] = await Promise.all([
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('resource_prices').select('*')
    ]);

    const ks = kRes.data || [];
    const ps = pRes.data || [];
    setKingdoms(ks);
    setPrices(ps);

    // Build form state
    const initial: Record<string, Record<ResourceType, string>> = {};
    
    // Global
    initial['global'] = { food: '0', wood: '0', stone: '0', gold: '0' };
    
    // Each kingdom
    ks.forEach(k => {
      initial[k.id.toString()] = { food: '', wood: '', stone: '', gold: '' };
    });

    // Fill with existing data
    ps.forEach(p => {
      const key = p.kingdom_id ? p.kingdom_id.toString() : 'global';
      if (initial[key]) {
        initial[key][p.resource as ResourceType] = p.price_per_million.toString();
      }
    });

    setFormData(initial);
    setLoading(false);
  }

  function handleInputChange(kingdomId: string | null, resource: ResourceType, value: string) {
    const key = kingdomId ? kingdomId.toString() : 'global';
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [resource]: value
      }
    }));
  }

  async function handleSave() {
    setSaving(true);
    
    const upserts = [];
    
    // Process global
    for (const res of RESOURCES) {
      upserts.push({
        kingdom_id: null,
        resource: res,
        price_per_million: parseFloat(formData['global']?.[res] || '0') || 0
      });
    }

    // Process kingdoms
    for (const k of kingdoms) {
      const kId = k.id.toString();
      for (const res of RESOURCES) {
        const valStr = formData[kId]?.[res];
        if (valStr !== undefined && valStr !== '') {
          upserts.push({
            kingdom_id: k.id,
            resource: res,
            price_per_million: parseFloat(valStr) || 0
          });
        }
      }
    }

    // Supabase upsert requires unique constraint on (kingdom_id, resource)
    // which we added in schema.sql
    const { error } = await supabase.from('resource_prices').upsert(upserts, { onConflict: 'kingdom_id,resource' });
    
    setSaving(false);
    if (!error) alert('Harga berhasil disimpan!');
    else alert('Gagal menyimpan harga: ' + error.message);
    
    fetchData();
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Harga Resource</h1>
          <p className="text-sm text-[#6B8079] mt-1">Atur nilai konversi resource (harga per juta). Biarkan kosong untuk menggunakan harga global.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Perubahan
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-1/4">Kingdom</th>
                {RESOURCES.map(res => (
                  <th key={res} className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", RESOURCE_DOT[res])}></div>
                      {RESOURCE_LABELS[res]} (/m)
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {/* GLOBAL ROW */}
              <tr className="bg-[#0E3D40]/5">
                <td className="py-4 px-4">
                  <div className="font-bold text-[#0E3D40]">🌍 Harga Global (Default)</div>
                  <div className="text-[10px] text-[#6B8079] mt-0.5">Digunakan jika kingdom tidak diset.</div>
                </td>
                {RESOURCES.map(res => (
                  <td key={res} className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end">
                      <span className="text-[#6B8079] text-xs mr-2">Rp</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={formData['global']?.[res] || ''}
                        onChange={e => handleInputChange(null, res, e.target.value)}
                        className="w-24 text-right font-mono text-sm py-1.5 px-2 border border-[#E8DDC9] focus:border-[#2BB673] rounded shadow-inner outline-none bg-white font-semibold text-[#0E3D40]" 
                      />
                    </div>
                  </td>
                ))}
              </tr>

              {/* KINGDOM ROWS */}
              {kingdoms.map(k => (
                <tr key={k.id} className="hover:bg-[#FAF5EA]/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold px-2.5 py-1 rounded-full border text-xs inline-block" style={{ borderColor: k.color_hex, color: k.color_hex, backgroundColor: `${k.color_hex}10` }}>
                      {k.name}
                    </span>
                  </td>
                  {RESOURCES.map(res => {
                    const val = formData[k.id.toString()]?.[res];
                    const hasOverride = val !== undefined && val !== '';
                    return (
                      <td key={res} className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <span className={cn("text-xs mr-2", hasOverride ? "text-[#0E3D40] font-semibold" : "text-[#6B8079]/50")}>Rp</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder={formData['global']?.[res] || '0'}
                            value={val || ''}
                            onChange={e => handleInputChange(k.id.toString(), res, e.target.value)}
                            className={cn(
                              "w-24 text-right font-mono text-sm py-1 px-2 border rounded outline-none transition-colors",
                              hasOverride 
                                ? "border-[#2BB673] bg-[#2BB673]/5 text-[#0E3D40] font-semibold shadow-inner" 
                                : "border-transparent bg-transparent text-[#6B8079] focus:border-[#E8DDC9] focus:bg-white focus:shadow-inner"
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
