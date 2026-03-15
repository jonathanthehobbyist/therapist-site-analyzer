'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith('/share/') || pathname === '/login') return null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <nav className="bg-white px-6 py-3 fixed top-0 left-0 right-0 z-50" style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="flex items-center gap-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-sage" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-sky" />
            <span className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
          </span>
          <span className="text-brand-charcoal">Practice Persona</span>
        </a>
        <div className="flex items-center gap-5">
          <a
            href="/history"
            className="text-xs text-gray-500 hover:text-brand-charcoal transition-colors"
          >
            History
          </a>
          <a
            href="/settings"
            className="text-xs text-gray-500 hover:text-brand-charcoal transition-colors"
          >
            Settings
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-brand-charcoal-light hover:text-brand-charcoal transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Analysis
          </a>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
