'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LogOut, User, ChevronDown, Package, Menu } from 'lucide-react';
import type { Profile } from '@/lib/types';

export default function Navbar({
  profile,
  onToggleSidebar,
}: {
  profile: Profile | null;
  onToggleSidebar?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0E3D40]/80 backdrop-blur-md border-b border-white/10 shadow-md">
      <div className="w-full px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Logo and Sidebar Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 flex items-center justify-center shrink-0">
              <img src="/logo.jpeg" alt="DR Resources" className="w-full h-full object-cover" />
            </div>
            <span className="text-white font-extrabold text-sm tracking-tight hidden sm:block">
              DR Resources
            </span>
          </Link>
        </div>

        {/* Right: User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <div className="w-7 h-7 rounded-full bg-[#2BB673]/20 border border-[#2BB673]/40 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-[#2BB673]" />
            </div>
            <span className="text-sm font-semibold hidden sm:block">{profile?.name ?? 'User'}</span>
            {profile?.role === 'admin' && (
              <span className="badge-admin hidden sm:inline-flex">Admin</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-[#E8DDC9] shadow-xl z-20 overflow-hidden animate-fadeIn">
                <div className="p-3 border-b border-[#E8DDC9]">
                  <p className="text-xs font-bold text-[#0E3D40] truncate">{profile?.name}</p>
                  <p className="text-[10px] text-[#6B8079] truncate">{profile?.email}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-[#0E3D40] hover:bg-[#FAF5EA] transition-colors"
                >
                  <User className="w-3.5 h-3.5" /> Edit Profil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#D9745A] hover:bg-[#D9745A]/5 transition-colors border-t border-[#E8DDC9]"
                >
                  <LogOut className="w-3.5 h-3.5" /> Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
