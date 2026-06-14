import { createClient } from '@/lib/supabase/server';
import { fmt } from '@/lib/utils';
import { Clock, User } from 'lucide-react';

export default async function AdminLogsPage() {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('*, profile:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Activity Logs</h1>
        <p className="text-sm text-[#6B8079] mt-1">Riwayat aktivitas sistem (max 1000 entry, otomatis dibersihkan).</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDC9]/50">
              {(!logs || logs.length === 0) ? (
                <tr><td colSpan={4} className="py-8 text-center text-[#6B8079]">Belum ada log.</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-[#FAF5EA]/30 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-[#6B8079]">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-[#6B8079]" />
                      <span className="font-semibold text-[#0E3D40] text-xs">
                        {(log as any).profile?.name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0E3D40]/5 text-[#0E3D40]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#5C6E6E] max-w-[300px] truncate font-mono">
                    {log.details ? JSON.stringify(log.details) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
