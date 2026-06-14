import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DR Resources',
  description: 'Guild resource management tool for Rise of Kingdoms',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className={`${inter.className} h-full bg-[#F5EFE0] text-[#0E3D40]`}>
        {children}
      </body>
    </html>
  );
}
