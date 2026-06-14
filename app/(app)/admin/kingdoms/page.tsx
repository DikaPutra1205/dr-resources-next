'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Kingdom } from '@/lib/types';
import { Plus, Edit2, Trash2, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function KingdomsPage() {
  const supabase = createClient();
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formKingdom, setFormKingdom] = useState<Partial<Kingdom>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('kingdoms').select('*').order('name');
    if (data) setKingdoms(data);
    setLoading(false);
  }

  function handleOpenModal(k?: Kingdom) {
    if (k) setFormKingdom(k);
    else setFormKingdom({ name: '', color_hex: '#2BB673' });
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: formKingdom.name,
      color_hex: formKingdom.color_hex || '#2BB673',
    };

    if (formKingdom.id) {
      await supabase.from('kingdoms').update(payload).eq('id', formKingdom.id);
    } else {
      await supabase.from('kingdoms').insert(payload);
    }

    setSaving(false);
    setIsModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin ingin menghapus kingdom ini? Akun yang terkait akan menjadi "Tanpa Kingdom".')) return;
    await supabase.from('kingdoms').delete().eq('id', id);
    fetchData();
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Manajemen Kingdom</h1>
          <p className="text-sm text-[#6B8079] mt-1">Tambah atau edit daftar kingdom.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> Tambah Kingdom
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Nama Kingdom</th>
              <th className="py-3 px-4 text-center">Warna (Hex)</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8DDC9]/50">
            {kingdoms.length === 0 ? (
              <tr><td colSpan={3} className="py-8 text-center text-[#6B8079]">Belum ada kingdom.</td></tr>
            ) : kingdoms.map(k => (
              <tr key={k.id} className="hover:bg-[#FAF5EA]/50 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-bold px-2.5 py-1 rounded-full border text-xs" style={{ borderColor: k.color_hex, color: k.color_hex, backgroundColor: `${k.color_hex}10` }}>
                    {k.name}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono text-xs text-[#6B8079]">
                  {k.color_hex}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleOpenModal(k)} className="p-1.5 text-[#6B8079] hover:text-[#2BB673] hover:bg-[#2BB673]/10 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(k.id)} className="p-1.5 text-[#6B8079] hover:text-[#D9745A] hover:bg-[#D9745A]/10 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3D40]/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-[#E8DDC9] bg-[#FAF5EA]">
              <h2 className="text-lg font-bold text-[#0E3D40]">{formKingdom.id ? 'Edit Kingdom' : 'Tambah Kingdom'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="label">Nama Kingdom</label>
                <input type="text" required value={formKingdom.name || ''} onChange={e => setFormKingdom({...formKingdom, name: e.target.value})} className="input" placeholder="Misal: 1024" />
              </div>
              <div>
                <label className="label">Warna Label (Hex)</label>
                <div className="flex gap-3 items-center">
                  <input type="color" value={formKingdom.color_hex || '#2BB673'} onChange={e => setFormKingdom({...formKingdom, color_hex: e.target.value})} className="h-10 w-10 p-1 border border-[#E8DDC9] rounded cursor-pointer" />
                  <input type="text" required pattern="^#[0-9a-fA-F]{6}$" value={formKingdom.color_hex || '#2BB673'} onChange={e => setFormKingdom({...formKingdom, color_hex: e.target.value})} className="input flex-1 font-mono" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-[#E8DDC9] mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Batal</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
