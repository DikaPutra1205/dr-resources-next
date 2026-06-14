'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Shield, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // This is a simplified user management. Supabase doesn't let you create users easily from the client side without using the service role key or Edge Functions, because only users can sign themselves up.
  // In a real app, you'd use Supabase Admin API via a Route Handler.
  // For this port, we will just list the profiles and allow changing their roles.
  
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleRoleChange(id: string, newRole: string) {
    if (!confirm(`Ubah role user ini menjadi ${newRole}?`)) return;
    
    // Optimistic UI update
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole as any } : u));
    
    await supabase.from('profiles').update({ role: newRole }).eq('id', id);
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Manajemen User</h1>
        <p className="text-sm text-[#6B8079] mt-1">Ubah role user yang terdaftar. (Pembuatan user baru dilakukan dari halaman login/register atau via backend Supabase)</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#FAF5EA] border-b border-[#E8DDC9] font-bold text-[#5C6E6E] uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role Saat Ini</th>
              <th className="py-3 px-4 text-center">Ubah Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8DDC9]/50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-[#FAF5EA]/50 transition-colors">
                <td className="py-3 px-4 font-bold text-[#0E3D40]">{user.name}</td>
                <td className="py-3 px-4 text-[#6B8079]">{user.email}</td>
                <td className="py-3 px-4">
                  {user.role === 'admin' 
                    ? <span className="badge-admin">Admin</span> 
                    : <span className="badge-user">User</span>
                  }
                </td>
                <td className="py-3 px-4 text-center">
                  <select 
                    value={user.role} 
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    className="text-xs border border-[#E8DDC9] rounded bg-white px-2 py-1 outline-none focus:border-[#2BB673]"
                  >
                    <option value="user">Jadikan User</option>
                    <option value="admin">Jadikan Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
