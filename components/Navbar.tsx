'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './theme-toggle';
import { useState } from 'react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="w-full bg-muted-foreground px-4 py-2 relative">
      <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center min-w-[40px]">
          <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
        </div>
        {/* Desktop menu */}
        <div className="hidden md:flex flex-1 justify-evenly items-center">
          <Link href="/sign-in" className="text-xl tracking-widest font-hestia hover:underline">
            SIGN IN
          </Link>
          <Link href="/sign-up" className="text-xl tracking-widest font-hestia hover:underline">
            SIGN UP
          </Link>
          <ThemeToggle className="mt-2 mr-2" />
        </div>
        {/* Hamburger for mobile */}
        <ThemeToggle className="mt-2 mr-12 md:hidden" />
        <button
          className="md:hidden flex items-center ml-auto"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu">
          <svg width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 7h20M4 14h20M4 21h20" />
          </svg>
        </button>
      </div>
      {/* Mobile menu absolutely positioned with transition */}
      <div
        className={`
          md:hidden flex flex-col items-center gap-4 py-4 transition-all duration-300 ease-in-out origin-top absolute left-0 right-0 top-full w-full bg-muted-foreground z-50
          ${open ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-0 pointer-events-none'}
        `}>
        <Link
          href="/sign-in"
          className="text-lg tracking-widest font-hestia hover:underline w-full text-center"
          onClick={() => setOpen(false)}>
          SIGN IN
        </Link>
        <Link
          href="/sign-up"
          className="text-lg tracking-widest font-hestia hover:underline w-full text-center"
          onClick={() => setOpen(false)}>
          SIGN UP
        </Link>
      </div>
    </nav>
  );
}
