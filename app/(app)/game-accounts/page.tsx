'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameAccount, Kingdom, ResourceType, Profile } from '@/lib/types';
import { Plus, Edit2, Trash2, Loader2, Save, Check, Shield, X } from 'lucide-react';
import { log } from '@/lib/logger';
import { RESOURCES, RESOURCE_LABELS, RESOURCE_COLORS, RESOURCE_DOT, RESOURCE_BORDER, cn, fmt, parseShorthand, formatInput } from '@/lib/utils';

export default function GameAccountsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formAccount, setFormAccount] = useState<Partial<GameAccount>>({});
  const [saving, setSaving] = useState(false);

  const [editingStock, setEditingStock] = useState<{ id: number, resource: ResourceType } | null>(null);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let localUserId = '';
    let localIsAdmin = false;
    if (user) {
      localUserId = user.id;
      setUserId(user.id);
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      localIsAdmin = prof?.role === 'admin';
      setIsAdmin(localIsAdmin);
    }

    const [accRes, kRes, pRes] = await Promise.all([
      supabase.from('game_accounts').select(`*, kingdom:kingdoms(*), resource_stock:resource_stocks(*), profile:profiles(name)`).order('id', { ascending: true }),
      supabase.from('kingdoms').select('*').order('name'),
      supabase.from('profiles').select('*').order('name')
    ]);

    if (accRes.data) {
      let data = (accRes.data as any[]).map((a: any) => ({
        ...a,
        resource_stock: Array.isArray(a.resource_stock) ? a.resource_stock[0] : a.resource_stock,
      })) as GameAccount[];
      if (!localIsAdmin && localUserId) data = data.filter(a => a.user_id === localUserId);
      setAccounts(data);
    }
    if (kRes.data) setKingdoms(kRes.data);
    if (pRes.data) setProfiles(pRes.data);
    setLoading(false);
  }

  function handleOpenModal(acc?: GameAccount) {
    if (acc) {
      setFormAccount(acc);
    } else {
      setFormAccount({ name: '', type: 'main', trading_post_level: 25, storehouse_level: 25, kingdom_id: kingdoms[0]?.id || null, notes: '', user_id: userId });
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
      if (error) { alert('Gagal update: ' + error.message); setSaving(false); return; }
      log('account.update', { account_id: formAccount.id, ...payload });
    } else {
      const { data, error } = await supabase.from('game_accounts').insert(payload).select('id').single();
      if (error) { alert('Gagal simpan: ' + error.message); setSaving(false); return; }
      if (data) {
        newAccountId = data.id;
        await supabase.from('resource_stocks').insert({ game_account_id: newAccountId });
        log('account.create', { account_id: data.id, name: payload.name, owner: payload.user_id });
      }
    }
    setSaving(false);
    setIsModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Yakin ingin menghapus akun ini? Semua data stok akan hilang.')) return;
    await supabase.from('game_accounts').delete().eq('id', id);
    log('account.delete', { account_id: id });
    fetchData();
  }

  async function handleSaveStock(accId: number, resource: ResourceType) {
    const val = parseShorthand(stockInput);
    await supabase.from('resource_stocks').update({ [resource]: val, updated_at: new Date().toISOString() }).eq('game_account_id', accId);
    setEditingStock(null);
    setStockInput('');
    fetchData();
  }

  // Group accounts by kingdom
  const kingdomGroups = useMemo(() => {
    const map = new Map<string, { kingdomId: number | null; kingdomName: string; colorHex: string; accounts: GameAccount[] }>();
    accounts.forEach(acc => {
      const kd = acc.kingdom as any;
      const key = String(kd?.id ?? 'none');
      if (!map.has(key)) map.set(key, { kingdomId: kd?.id ?? null, kingdomName: kd?.name ?? 'Tanpa Kingdom', colorHex: kd?.color_hex ?? '#6B8079', accounts: [] });
      map.get(key)!.accounts.push(acc);
    });
    return Array.from(map.values()).sort((a, b) => a.kingdomName.localeCompare(b.kingdomName));
  }, [accounts]);

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Akun Game</h1>
          <p className="text-sm text-[#6B8079] mt-1">Kelola akun dan update stok resource per kingdom.</p>
        </div>
        {isAdmin && (
          <button onClick={() => handleOpenModal()} className="btn-primary shrink-0">
            <Plus className="w-4 h-4" /> Tambah Akun
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {kingdomGroups.map(g => (
          <span
            key={g.kingdomName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
            style={{ borderColor: g.colorHex, color: g.colorHex, backgroundColor: `${g.colorHex}15` }}
          >
            <Shield className="w-3 h-3" />
            {g.kingdomName}
            <span className="ml-0.5 opacity-70">· {g.accounts.length}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-[#E8DDC9] text-[#5C6E6E] bg-[#FAF5EA]">
          Total {accounts.length} akun
        </span>
      </div>

      {/* Kingdom groups */}
      {accounts.length === 0 ? (
        <div className="card p-12 text-center text-[#6B8079]">Belum ada akun game.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {kingdomGroups.map(group => (
            <div key={group.kingdomName} className="card overflow-hidden">
              {/* Kingdom header */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E8DDC9]"
                style={{ backgroundColor: `${group.colorHex}12` }}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.colorHex }} />
                <span className="font-extrabold text-sm tracking-tight" style={{ color: group.colorHex }}>
                  {group.kingdomName}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${group.colorHex}20`, color: group.colorHex }}
                >
                  {group.accounts.length} akun
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] text-[#5C6E6E] text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-5 font-bold">Nama Akun</th>
                      {isAdmin && <th className="py-2.5 px-4 font-bold">Pemilik</th>}
                      <th className="py-2.5 px-4 text-center font-bold">TP / SH</th>
                      <th className="py-2.5 px-4 font-bold">Catatan</th>
                      {RESOURCES.map(res => (
                        <th key={res} className="py-2.5 px-4 text-right font-bold">
                          <div className="flex items-center justify-end gap-1">
                            <div className={cn('w-1.5 h-1.5 rounded-full', RESOURCE_DOT[res])} />
                            {RESOURCE_LABELS[res]}
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-4 text-center font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.accounts.map((acc, idx) => (
                      <tr
                        key={acc.id}
                        className={cn(
                          'hover:bg-[#FAF5EA]/60 transition-colors',
                          idx !== group.accounts.length - 1 && 'border-b border-[#E8DDC9]/50'
                        )}
                      >
                        {/* Nama & badge */}
                        <td className="py-3 px-5">
                          <div className="font-bold text-[#0E3D40] leading-tight">{acc.name}</div>
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5 inline-block',
                            acc.type === 'main' ? 'bg-[#0E3D40] text-white' : 'bg-[#E8DDC9] text-[#5C6E6E]'
                          )}>
                            {acc.type}
                          </span>
                        </td>

                        {/* Pemilik (admin only) */}
                        {isAdmin && (
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-[#0E3D40] bg-[#0E3D40]/5 px-2 py-0.5 rounded-full">
                              {(acc as any).profile?.name || '-'}
                            </span>
                          </td>
                        )}

                        {/* TP / SH */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-mono text-xs bg-[#E8DDC9]/40 px-2 py-1 rounded-lg">
                            <span className="font-bold text-[#0E3D40]">{acc.trading_post_level}</span>
                            <span className="text-[#6B8079]/50">/</span>
                            <span className="font-bold text-[#0E3D40]">{acc.storehouse_level}</span>
                          </span>
                        </td>

                        {/* Catatan */}
                        <td className="py-3 px-4 text-[#6B8079] text-xs max-w-[140px] truncate" title={acc.notes || ''}>
                          {acc.notes || <span className="opacity-30">—</span>}
                        </td>

                        {/* Resource stocks */}
                        {RESOURCES.map(res => {
                          const isEditing = editingStock?.id === acc.id && editingStock?.resource === res;
                          const stockVal = acc.resource_stock?.[res] ?? 0;
                          const canEdit = acc.user_id === userId || isAdmin;

                          return (
                            <td
                              key={res}
                              className="py-3 px-4 text-right font-mono"
                              onClick={() => {
                                if (!isEditing && canEdit) {
                                  setEditingStock({ id: acc.id, resource: res });
                                  setStockInput(stockVal > 0 ? stockVal.toString() : '');
                                }
                              }}
                            >
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
                                  <button type="button" onClick={() => handleSaveStock(acc.id, res)}
                                    className="p-0.5 text-emerald-600 hover:text-emerald-800 bg-emerald-50 rounded border border-emerald-300 shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <button type="button" onClick={() => setEditingStock(null)}
                                    className="p-0.5 text-red-500 hover:text-red-700 bg-red-50 rounded border border-red-300 shrink-0">
                                    <X className="w-3 h-3 stroke-[3]" />
                                  </button>
                                </div>
                              ) : (
                                <div className={cn(
                                  'group inline-flex items-center gap-1.5 px-2 py-1 rounded transition-colors',
                                  canEdit && 'cursor-pointer hover:bg-black/5',
                                  stockVal > 0 ? 'text-[#0E3D40] font-semibold' : 'text-[#6B8079]/30'
                                )}>
                                  {stockVal > 0 && <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', RESOURCE_DOT[res])} />}
                                  <span>{fmt(stockVal)}</span>
                                  {canEdit && <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity text-[#2BB673]" />}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Aksi */}
                        <td className="py-3 px-4 text-center">
                          {(acc.user_id === userId || isAdmin) && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => handleOpenModal(acc)}
                                className="p-1.5 text-[#6B8079] hover:text-[#2BB673] hover:bg-[#2BB673]/10 rounded-lg transition-colors"
                                title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin && (
                                <button onClick={() => handleDelete(acc.id)}
                                  className="p-1.5 text-[#6B8079] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Hapus">
                                  <Trash2 className="w-3.5 h-3.5" />
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
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3D40]/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDC9] bg-[#0E3D40]">
              <h2 className="text-base font-bold text-white">
                {formAccount.id ? 'Edit Akun Game' : 'Tambah Akun Game'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {isAdmin ? (
                  <>
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
                    <div className="col-span-2">
                      <label className="label">Pemilik Akun</label>
                      <select value={formAccount.user_id || ''} onChange={e => setFormAccount({...formAccount, user_id: e.target.value})} className="input py-2.5">
                        <option value="">-- Pilih Pemilik --</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Catatan (opsional)</label>
                      <input type="text" value={formAccount.notes || ''} onChange={e => setFormAccount({...formAccount, notes: e.target.value})} className="input" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <label className="label">Nama Akun</label>
                      <p className="input bg-[#FAF5EA]/50 text-[#0E3D40] font-medium py-2 px-3 rounded-lg border border-[#E8DDC9]">{formAccount.name}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Tipe / Kingdom</label>
                      <p className="input bg-[#FAF5EA]/50 text-[#0E3D40] font-medium py-2 px-3 rounded-lg border border-[#E8DDC9]">
                        {formAccount.type === 'main' ? 'Main' : 'Farm'} &middot; {kingdoms.find(k => k.id === formAccount.kingdom_id)?.name || '-'}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Level Trading Post</label>
                  <input type="number" min={1} max={25} required value={formAccount.trading_post_level || 1} onChange={e => setFormAccount({...formAccount, trading_post_level: Number(e.target.value)})} className="input" />
                </div>
                <div>
                  <label className="label">Level Storehouse</label>
                  <input type="number" min={1} max={25} required value={formAccount.storehouse_level || 1} onChange={e => setFormAccount({...formAccount, storehouse_level: Number(e.target.value)})} className="input" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-[#E8DDC9] mt-2">
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
