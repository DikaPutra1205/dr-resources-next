import { createClient } from '@/lib/supabase/server';
import { fmt } from '@/lib/utils';
import { Clock, User, Circle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLogsPage() {
  const supabase = await createClient();

  const [logsRes, activeRes] = await Promise.all([
    supabase
      .from('activity_logs')
      .select('*, profile:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('profiles')
      .select('id, name, email, role, last_active_at')
      .gt('last_active_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('last_active_at', { ascending: false }),
  ]);

  const logs = logsRes.data;
  const activeUsers = activeRes.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Activity Logs</h1>
        <p className="text-sm text-[#6B8079] mt-1">Riwayat aktivitas sistem — log otomatis dibersihkan (max 500).</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Logs table */}
        <div className="flex-1 card overflow-hidden">
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

        {/* Active users sidebar */}
        <div className="lg:w-72 shrink-0">
          <div className="card">
            <h2 className="text-sm font-bold text-[#0E3D40] flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Active Now
            </h2>
            {(!activeUsers || activeUsers.length === 0) ? (
              <p className="text-xs text-[#6B8079]">Tidak ada user aktif.</p>
            ) : (
              <div className="space-y-3">
                {activeUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0E3D40] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0E3D40] truncate">{u.name}</p>
                      <p className="text-[10px] text-[#6B8079]">
                        {Math.floor((Date.now() - new Date(u.last_active_at).getTime()) / 60000)}m ago
                      </p>
                    </div>
                    <Circle className="w-2 h-2 fill-green-500 text-green-500 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-[#6B8079] mt-2 text-center">5 menit sejak aktivitas terakhir</p>
        </div>
      </div>
    </div>
  );
}
