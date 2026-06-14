'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, ArrowLeftRight, Gamepad2, BarChart3, Menu, X, Shield, Users, Globe, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/',              label: 'Beranda',      icon: LayoutDashboard },
  { href: '/calculator',    label: 'Kalkulator',   icon: Calculator },
  { href: '/transactions',  label: 'Transaksi',    icon: ArrowLeftRight },
  { href: '/game-accounts', label: 'Akun Game',    icon: Gamepad2 },
];

const adminItems: NavItem[] = [
  { href: '/admin/users',                label: 'Manajemen User',    icon: Users },
  { href: '/admin/kingdoms',             label: 'Kingdom',           icon: Globe },
  { href: '/admin/prices',              label: 'Harga Resource',    icon: Settings },
  { href: '/admin/transactions/create', label: 'Tambah Transaksi',  icon: ArrowLeftRight },
];

export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Bottom Nav Bar (Main Items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#E8DDC9]/50 z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-around p-2">
          {navItems.map(item => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 w-16',
                  isActive ? 'text-[#2BB673]' : 'text-[#6B8079] hover:text-[#0E3D40]'
                )}
              >
                <div className={cn(
                  'p-1.5 rounded-lg transition-colors mb-1',
                  isActive ? 'bg-[#2BB673]/10' : 'bg-transparent'
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
              </Link>
            );
          })}
          
          {/* Menu Toggle for Admin / Net Stock */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center justify-center p-2 text-[#6B8079] w-16"
          >
            <div className="p-1.5 mb-1"><Menu className="w-5 h-5" /></div>
            <span className="text-[10px] font-semibold tracking-tight">Menu</span>
          </button>
        </div>
      </nav>

      {/* Slide Up Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-[#0E3D40]/30 backdrop-blur-sm transition-opacity animate-fadeIn" onClick={() => setMenuOpen(false)}></div>
          
          <div className="bg-white/90 backdrop-blur-xl border border-white/40 shadow-2xl w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-12 sm:pb-6 relative z-10 animate-slideUp">
            <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 p-2 bg-black/5 text-black/50 rounded-full hover:bg-black/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold text-[#0E3D40] mb-4 border-b border-black/5 pb-2">Menu Tambahan</h3>
            
            <div className="space-y-1">
              <Link href="/net-stock" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors text-[#0E3D40] font-semibold">
                <BarChart3 className="w-5 h-5 text-[#2BB673]" />
                Net Stock (Keseluruhan)
              </Link>
            </div>

            {isAdmin && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2 px-2 text-[#6B8079]">
                  <Shield className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Admin Panel</span>
                </div>
                <div className="space-y-1">
                  {adminItems.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors text-[#0E3D40] font-semibold">
                      <item.icon className="w-5 h-5 opacity-70" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
