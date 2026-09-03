'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from './theme/ThemeToggle';

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/squads', label: 'Squad' },
    { href: '/lineups', label: 'Lineups' },
    { href: '/transfers', label: 'Transfers' },
    { href: '/leagues', label: 'Leagues' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D2</span>
            </div>
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Fantasy
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-amber-500 border-b-2 border-amber-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/profile"
              className={`text-sm font-medium transition-colors ${
                isActive('/profile') ? 'text-amber-500' : 'text-slate-400 hover:text-white'
              }`}
            >
              Profile
            </Link>
            <Link
              href="/account"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Account
            </Link>
            <button className="bg-linear-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-orange-500/20 transition-all">
              Sign Out
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="px-4 py-2"><ThemeToggle /></div>
              <Link
                href="/profile"
                className={`block px-4 py-2 transition-colors ${
                  isActive('/profile')
                    ? 'text-amber-500'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/account"
                className="block px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Account
              </Link>
              <button className="w-full mt-2 bg-linear-to-r from-amber-500 to-orange-600 text-white px-4 py-2 rounded-lg font-medium">
                Sign Out
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
