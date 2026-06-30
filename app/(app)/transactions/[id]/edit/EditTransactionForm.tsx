'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { log } from '@/lib/logger';

interface EditFormProps {
  tx: {
    id: number;
    to_name: string;
    notes: string | null;
    sent_at: string;
    status: string;
  };
  txCode: string;
}

export default function EditTransactionForm({ tx, txCode }: EditFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const toWIB = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
    return d.toISOString().substring(0, 16);
  };

  const [toName, setToName] = useState(tx.to_name);
  const [notes, setNotes] = useState(tx.notes || '');
  const [sentAt, setSentAt] = useState(toWIB(tx.sent_at));
  const [status, setStatus] = useState<'pending' | 'done'>(
    tx.status === 'done' ? 'done' : 'pending'
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!toName.trim()) return alert('Nama penerima harus diisi.');
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('transactions').update({
      to_name: toName.trim(),
      notes: notes.trim() || null,
      sent_at: new Date(sentAt).toISOString(),
      status,
    }).eq('id', tx.id);

    if (error) {
      alert('Gagal menyimpan: ' + error.message);
      setSaving(false);
    } else {
      await log('transaction.edit', {
        transaction_id: tx.id,
        code: txCode,
        changes: { to_name: toName.trim(), status },
      }, user?.id);
      router.push(`/transactions/${tx.id}`);
      router.refresh();
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/transactions/${tx.id}`}
          className="p-2 bg-white border border-[#E8DDC9] text-[#6B8079] hover:text-[#0E3D40] rounded-xl hover:shadow-sm transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Edit Transaksi</h1>
          <p className="text-sm text-[#6B8079] mt-0.5 font-mono">{txCode}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8DDC9] shadow-sm p-6 space-y-5">
        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-2">Status</label>
          <div className="flex gap-2">
            {([
              ['pending', '⏳ Pending',  'bg-amber-50 border-amber-400 text-amber-700'],
              ['done',    '✅ Selesai',  'bg-emerald-50 border-emerald-400 text-emerald-700'],
            ] as const).map(([val, label, cls]) => (
              <button key={val} type="button"
                onClick={() => setStatus(val)}
                className={`flex-1 text-sm font-bold py-2.5 px-4 rounded-xl border-2 transition-all ${
                  status === val ? cls : 'border-[#E8DDC9] text-[#6B8079] bg-white hover:border-[#C4B998]'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Nama Penerima */}
        <div>
          <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-2">
            Nama Penerima
          </label>
          <input
            type="text"
            value={toName}
            onChange={e => setToName(e.target.value)}
            placeholder="Nama in-game buyer..."
            className="w-full rounded-xl border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm py-2.5 px-3.5 font-semibold outline-none"
          />
        </div>

        {/* Tanggal Pengiriman */}
        <div>
          <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-2">
            Tanggal &amp; Waktu Pengiriman
          </label>
          <input
            type="datetime-local"
            value={sentAt}
            onChange={e => setSentAt(e.target.value)}
            className="w-full rounded-xl border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm py-2.5 px-3.5 font-semibold outline-none"
          />
        </div>

        {/* Catatan */}
        <div>
          <label className="block text-xs font-bold text-[#6B8079] uppercase tracking-wider mb-2">
            Catatan <span className="font-normal normal-case opacity-60">(opsional)</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Catatan tambahan..."
            className="w-full rounded-xl border border-[#E8DDC9] text-[#0E3D40] focus:border-[#2BB673] focus:ring focus:ring-[#2BB673]/20 bg-[#FAF5EA]/50 text-sm py-2.5 px-3.5 font-semibold outline-none resize-none"
          />
        </div>

        <div className="pt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !toName.trim()}
            className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-3 bg-[#2BB673] hover:bg-[#23945d] text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-sm transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              : <><Save className="w-4 h-4" /> Simpan Perubahan</>
            }
          </button>
          <Link href={`/transactions/${tx.id}`}
            className="px-4 py-3 rounded-xl border border-[#E8DDC9] text-xs font-bold text-[#6B8079] hover:border-[#C4B998] hover:text-[#0E3D40] transition-colors text-center">
            Batal
          </Link>
        </div>
      </div>

      <p className="text-xs text-[#6B8079] text-center">
        ℹ️ Resource, kontributor, dan komisi tidak dapat diubah lewat form ini.
      </p>
    </div>
  );
}
