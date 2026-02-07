'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-black">
      <div className="container mx-auto px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 lg:gap-3 group">
            <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
            <div>
              <h1 className="text-base lg:text-lg font-bold tracking-wider text-emerald-400">
                AEGIS-3
              </h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider hidden sm:block">
                Adversarial AI Auditor
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 lg:gap-6">
            <Link
              href="/"
              className="text-xs lg:text-sm uppercase tracking-wider text-slate-400 hover:text-emerald-400 transition-colors hidden sm:inline"
            >
              Dashboard
            </Link>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <div className="status-analyzing" />
              <span className="uppercase tracking-wider hidden sm:inline">System Active</span>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
