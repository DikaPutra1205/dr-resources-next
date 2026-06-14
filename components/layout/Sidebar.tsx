'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calculator, Users, Gamepad2,
  ArrowLeftRight, BarChart3, Settings, Shield,
  ChevronRight, Globe, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/',              label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/net-stock',     label: 'Net Stock',     icon: BarChart3 },
  { href: '/calculator',   label: 'Kalkulator',    icon: Calculator },
  { href: '/transactions', label: 'Transaksi',     icon: ArrowLeftRight },
  { href: '/game-accounts',label: 'Akun Game',     icon: Gamepad2 },
];

const adminItems: NavItem[] = [
  { href: '/admin/users',                 label: 'Manajemen User',      icon: Users },
  { href: '/admin/kingdoms',              label: 'Kingdoms',            icon: Globe },
  { href: '/admin/prices',               label: 'Harga Resource',      icon: Settings },
  { href: '/admin/transactions/create',  label: 'Tambah Transaksi',    icon: ArrowLeftRight },
];

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.href === '/'
    ? pathname === '/'
    : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all group shrink-0 w-full',
        isActive
          ? 'bg-[#2BB673] text-white shadow-sm'
          : 'text-[#6B8079] hover:bg-[#FAF5EA] hover:text-[#0E3D40]',
      )}
    >
      <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-[#6B8079] group-hover:text-[#0E3D40]')} />
      <span className="flex-1 truncate">{item.label}</span>
      {isActive && <ChevronRight className="w-3 h-3 text-white/70 shrink-0" />}
    </Link>
  );
}

export default function Sidebar({
  isAdmin,
  isOpen,
  onClose,
}: {
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0E3D40]/30 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "flex flex-col bg-white/95 md:bg-white/80 backdrop-blur-xl border-r border-[#E8DDC9]/50 transition-all duration-300 ease-in-out overflow-hidden h-full shrink-0",
          "fixed inset-y-0 left-0 z-50 w-64 md:relative md:z-20",
          isOpen
            ? "translate-x-0 shadow-2xl md:shadow-[4px_0_24px_rgba(0,0,0,0.01)] md:w-56 md:p-4 p-5"
            : "-translate-x-full md:translate-x-0 md:w-0 md:p-0 md:border-r-0"
        )}
      >
        {/* Mobile Header Close Button */}
        <div className="flex items-center justify-between mb-4 md:hidden shrink-0">
          <span className="font-extrabold text-[#0E3D40] text-sm uppercase tracking-wider">Navigasi</span>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B8079] hover:bg-[#FAF5EA] hover:text-[#0E3D40] rounded-lg transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto">
          {navItems.map(item => <NavLink key={item.href} item={item} />)}
        </nav>

        {isAdmin && (
          <div className="shrink-0">
            <div className="mt-4 mb-1 px-3 flex items-center gap-2">
              <Shield className="w-3 h-3 text-[#6B8079]" />
              <span className="text-[10px] font-bold text-[#6B8079] uppercase tracking-widest">Admin</span>
            </div>
            <nav className="flex flex-col gap-0.5">
              {adminItems.map(item => <NavLink key={item.href} item={item} />)}
            </nav>
          </div>
        )}
      </aside>
    </>
  );
}
