'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, Kingdom, ResourceType, Profile } from '@/lib/types';
import { Plus, Edit2, Trash2, Loader2, Save, Check } from 'lucide-react';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_COLORS, RESOURCE_DOT, RESOURCE_BORDER, cn, fmt, parseShorthand, formatInput } from '@/lib/utils';

export default function GameAccountsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formAccount, setFormAccount] = useState<Partial<GameAccount>>({});
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editingStock, setEditingStock] = useState<{ id: number, resource: ResourceType } | null>(null);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(prof?.role === 'admin');
    }

    const [accRes, kRes, pRes] = await Promise.all([
      supabase.from('game_accounts').select(`
        *,
        kingdom:kingdoms(*),
        resource_stock:resource_stocks(*),
        profile:profiles(name)
      `).order('id', { ascending: true }),
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('profiles').select('*').order('name')
    ]);

    if (accRes.data) setAccounts(accRes.data as unknown as GameAccount[]);
    if (kRes.data) setKingdoms(kRes.data);
    if (pRes.data) setProfiles(pRes.data);
    setLoading(false);
  }

  function handleOpenModal(acc?: GameAccount) {
    if (acc) {
      setFormAccount(acc);
    } else {
      setFormAccount({
        name: '',
        type: 'main',
        trading_post_level: 25,
        storehouse_level: 25,
        kingdom_id: kingdoms[0]?.id || null,
        notes: '',
        user_id: userId
      });
    }
    setIsModalOpen(true);
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const payload = {
      name: formAccount.name,
      type: formAccount.type,
      trading_post_level: Number(formAccount.trading_post_level),
      storehouse_level: Number(formAccount.storehouse_level),
      kingdom_id: formAccount.kingdom_id ? Number(formAccount.kingdom_id) : null,
      notes: formAccount.notes || null,
      user_id: formAccount.user_id || userId
    };

    let newAccountId = formAccount.id;

    if (formAccount.id) {
      const { error } = await supabase.from('game_accounts').update(payload).eq('id', formAccount.id);
      if (error) {
        alert('Gagal update: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from('game_accounts').insert(payload).select('id').single();
      if (error) {
        alert('Gagal simpan: ' + error.message);
        console.error(error);
        setSaving(false);
        return;
      }
      if (data) {
        newAccountId = data.id;
        // Create initial stock
        await supabase.from('resource_stocks').insert({ game_account_id: newAccountId });
      }
    }

    setSaving(false);
    setIsModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin ingin menghapus akun ini? Semua data stok akan hilang.')) return;
    await supabase.from('game_accounts').delete().eq('id', id);
    fetchData();
  }

  async function handleSaveStock(accId: number, resource: ResourceType) {
    const val = parseShorthand(stockInput);
    await supabase.from('resource_stocks')
      .update({ [resource]: val, updated_at: new Date().toISOString() })
      .eq('game_account_id', accId);
    
    setEditingStock(null);
    setStockInput('');
    fetchData();
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Akun Game</h1>
          <p className="text-sm text-[#6B8079] mt-1">Kelola akun dan update stok resource.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" /> Tambah Akun
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">Nama Akun</th>
                {isAdmin && <th className="py-3 px-4 font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">Pemilik</th>}
                <th className="py-3 px-4 text-center font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">TP / SH</th>
                <th className="py-3 px-4 font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">Catatan</th>
                <th className="py-3 px-4 text-right">Food</th>
                <th className="py-3 px-4 text-right">Wood</th>
                <th className="py-3 px-4 text-right">Stone</th>
                <th className="py-3 px-4 text-right">Gold</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="py-8 text-center text-[#6B8079]">
                    Belum ada akun game.
                  </td>
                </tr>
              ) : accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-[#FAF5EA]/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#0E3D40]">{acc.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider', acc.type === 'main' ? 'bg-[#0E3D40] text-white' : 'bg-[#E8DDC9] text-[#5C6E6E]')}>
                        {acc.type}
                      </span>
                      {acc.kingdom && typeof acc.kingdom === 'object' ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: acc.kingdom.color_hex, color: acc.kingdom.color_hex, backgroundColor: `${acc.kingdom.color_hex}10` }}>
                          {acc.kingdom.name}
                        </span>
                      ) : acc.kingdom ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-black/20 text-black/70 bg-black/5">
                          {acc.kingdom as string}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-[#6B8079] text-xs">
                      {(acc as any).profile?.name || '-'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center font-mono text-xs text-[#6B8079]">
                    <span className="text-[#0E3D40] font-semibold">{acc.trading_post_level}</span>
                    <span className="mx-1 opacity-50">/</span>
                    <span className="text-[#0E3D40] font-semibold">{acc.storehouse_level}</span>
                  </td>
                  <td className="py-3 px-4 text-[#6B8079] text-xs max-w-[150px] truncate" title={acc.notes || ''}>
                    {acc.notes || '-'}
                  </td>
                  
                  {RESOURCES.map(res => {
                    const isEditing = editingStock?.id === acc.id && editingStock?.resource === res;
                    const stockVal = acc.resource_stock?.[res] ?? 0;
                    
                    return (
                      <td key={res} className="py-3 px-4 text-right font-mono" onClick={() => {
                        if (!isEditing && (acc.user_id === userId || isAdmin)) {
                          setEditingStock({ id: acc.id, resource: res });
                          setStockInput(stockVal > 0 ? stockVal.toString() : '');
                        }
                      }}>
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={formatInput(stockInput)}
                              onChange={e => setStockInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveStock(acc.id, res);
                                if (e.key === 'Escape') setEditingStock(null);
                              }}
                              className={cn('w-20 text-right text-xs py-1 px-2 border rounded shadow-inner outline-none', RESOURCE_BORDER[res])}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveStock(acc.id, res)}
                              className="p-0.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 rounded border border-emerald-300 shrink-0"
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStock(null)}
                              className="p-0.5 text-red-600 hover:text-red-800 bg-red-50 rounded border border-red-300 shrink-0"
                            >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className={cn('group cursor-pointer hover:bg-black/5 px-2 py-1 rounded inline-flex items-center gap-1.5 transition-colors', stockVal > 0 ? 'text-[#0E3D40] font-semibold' : 'text-[#6B8079]/50')}>
                            <span>{fmt(stockVal)}</span>
                            {acc.user_id === userId && (
                              <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity text-[#2BB673]" />
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  <td className="py-3 px-4 text-center">
                    {(acc.user_id === userId || isAdmin) && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleOpenModal(acc)} className="p-1.5 text-[#6B8079] hover:text-[#2BB673] hover:bg-[#2BB673]/10 rounded transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(acc.user_id === userId || isAdmin) && (
                          <button onClick={() => handleDelete(acc.id)} className="p-1.5 text-[#6B8079] hover:text-[#D9745A] hover:bg-[#D9745A]/10 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3D40]/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-[#E8DDC9] bg-[#FAF5EA]">
              <h2 className="text-lg font-bold text-[#0E3D40]">{formAccount.id ? 'Edit Akun' : 'Tambah Akun Game'}</h2>
            </div>
            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nama Akun</label>
                  <input type="text" required value={formAccount.name || ''} onChange={e => setFormAccount({...formAccount, name: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="label">Tipe</label>
                  <select value={formAccount.type || 'main'} onChange={e => setFormAccount({...formAccount, type: e.target.value as any})} className="input py-2.5">
                    <option value="main">Main</option>
                    <option value="farm">Farm</option>
                  </select>
                </div>
                <div>
                  <label className="label">Kingdom</label>
                  <select value={formAccount.kingdom_id || ''} onChange={e => setFormAccount({...formAccount, kingdom_id: e.target.value ? Number(e.target.value) : null})} className="input py-2.5">
                    <option value="">-- Pilih Kingdom --</option>
                    {kingdoms.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Level Trading Post</label>
                  <input type="number" min={1} max={25} required value={formAccount.trading_post_level || 1} onChange={e => setFormAccount({...formAccount, trading_post_level: Number(e.target.value)})} className="input" />
                </div>
                <div>
                  <label className="label">Level Storehouse</label>
                  <input type="number" min={1} max={25} required value={formAccount.storehouse_level || 1} onChange={e => setFormAccount({...formAccount, storehouse_level: Number(e.target.value)})} className="input" />
                </div>
                {isAdmin && (
                  <div className="col-span-2">
                    <label className="label">Pemilik Akun</label>
                    <select value={formAccount.user_id || ''} onChange={e => setFormAccount({...formAccount, user_id: e.target.value})} className="input py-2.5">
                      <option value="">-- Pilih Pemilik Akun --</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                    </select>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">Catatan (opsional)</label>
                  <input type="text" value={formAccount.notes || ''} onChange={e => setFormAccount({...formAccount, notes: e.target.value})} className="input" />
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
