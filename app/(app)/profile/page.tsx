'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        setName(data.name);
      }
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ name }).eq('id', profile.id);
    setSaving(false);
    
    if (!error) alert('Profil berhasil diperbarui!');
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#2BB673]" /></div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0E3D40] tracking-tight">Profil Akun</h1>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nama</label>
            <input 
              type="text" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="input" 
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input 
              type="email" 
              disabled 
              value={profile?.email || ''} 
              className="input opacity-50 cursor-not-allowed" 
            />
            <p className="text-[10px] text-[#6B8079] mt-1">Email tidak dapat diubah.</p>
          </div>
          <div>
            <label className="label">Role</label>
            <input 
              type="text" 
              disabled 
              value={profile?.role || ''} 
              className="input opacity-50 cursor-not-allowed uppercase" 
            />
          </div>
          <div className="pt-4 border-t border-[#E8DDC9] mt-6">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
