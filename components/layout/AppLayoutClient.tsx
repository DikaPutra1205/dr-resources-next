'use client';

import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import type { Profile } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

export default function AppLayoutClient({
  profile,
  children,
}: {
  profile: Profile | null;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Active user tracking — ping every 60s + on focus
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = createClient();
    const ping = () => {
      supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', profile.id).then(() => {});
    };
    ping();
    const interval = setInterval(ping, 60_000);
    const onFocus = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [profile?.id]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5EFE0] h-screen overflow-hidden">
      <Navbar profile={profile} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex flex-1 relative overflow-hidden h-[calc(100vh-3.5rem)]">
        <Sidebar
          isAdmin={profile?.role === 'admin'}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 lg:p-8 relative">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      <MobileNav isAdmin={profile?.role === 'admin'} />
    </div>
  );
}
