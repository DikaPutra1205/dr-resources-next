'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { STATUS_CONFIG, TransactionStatus } from '@/lib/utils';
import { Loader2, ChevronDown } from 'lucide-react';
import { log } from '@/lib/logger';

const ALL_STATUSES: TransactionStatus[] = ['pending', 'done'];

export default function StatusChanger({
  txId,
  currentStatus,
  isAdmin,
}: {
  txId: number;
  currentStatus: TransactionStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    // Non-admin: read-only badge
    const s = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.done;
    return (
      <span className={`text-xs px-2.5 py-1 rounded-full border font-bold inline-flex items-center gap-1.5 ${s.cls}`}>
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    );
  }

  async function changeStatus(newStatus: TransactionStatus) {
    if (newStatus === currentStatus) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', txId);
    if (error) {
      alert('Gagal mengubah status: ' + error.message);
    } else {
      await log('transaction.status_change', { transaction_id: txId, from: currentStatus, to: newStatus }, user?.id);
      router.refresh();
    }
    setSaving(false);
  }

  const current = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.done;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={saving}
        className={`text-xs px-2.5 py-1 rounded-full border font-bold inline-flex items-center gap-1.5 transition-all hover:opacity-80 cursor-pointer ${current.cls}`}
      >
        {saving
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <span className={`w-2 h-2 rounded-full ${current.dot}`} />
        }
        {current.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-[#E8DDC9] shadow-lg overflow-hidden w-40">
            {ALL_STATUSES.map(s => {
              const cfg = STATUS_CONFIG[s];
              const isActive = s === currentStatus;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-left transition-colors ${
                    isActive
                      ? 'bg-[#FAF5EA] text-[#0E3D40] cursor-default'
                      : 'text-[#0E3D40] hover:bg-[#FAF5EA] cursor-pointer'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  {cfg.label}
                  {isActive && <span className="ml-auto text-[9px] font-bold text-[#6B8079]">aktif</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
