'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './theme-toggle';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import UserAvatar from './UserAvatar';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Use dynamic export to ensure the component only renders on the client side
const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [initials, setInitials] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createSupabaseBrowserClient();

  const linkClass = (href: string) => {
    const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href) || pathname === href;
    return cn('text-3xl tracking-widest font-difont hover:underline underline-offset-4 mt-2', isActive && 'underline');
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (isMounted) {
        setIsAuthed(!!session);
        setInitials(extractInitials(session?.user?.user_metadata, session?.user?.email));
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
      setInitials(extractInitials(session?.user?.user_metadata, session?.user?.email));
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/');
  }

  function extractInitials(meta: Record<string, unknown> | undefined, email?: string | null) {
    const first =
      typeof (meta as { first_name?: unknown })?.first_name === 'string'
        ? (meta as { first_name: string }).first_name
        : '';
    const last =
      typeof (meta as { last_name?: unknown })?.last_name === 'string' ? (meta as { last_name: string }).last_name : '';
    const a = first.trim?.()[0];
    const b = last.trim?.()[0];
    if (a || b) return `${a || ''}${b || ''}`.toUpperCase();
    if (email) {
      const local = email.split('@')[0] || '';
      const letters = local.replace(/[^a-zA-Z]/g, '');
      return `${letters[0] || 'U'}${letters[1] || ''}`.toUpperCase();
    }
    return 'U';
  }

  // On home page when not authenticated, show only ThemeToggle
  if (!isAuthed && pathname === '/') {
    return <ThemeToggle className="absolute top-4 right-4" />;
  }

  return (
    <nav className="w-full bg-muted-foreground px-4 py-2 relative">
      <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center min-w-[40px]">
          <Link href="/">
            <Image src="/logo.svg" alt="Logo" width={40} height={40} className="object-contain" />
          </Link>
        </div>
        {/* Desktop menu */}
        <div className="hidden md:flex flex-1 items-center">
          <div className="flex flex-1 justify-center items-center gap-10">
            {/* <Link href="/" className={linkClass('/')}>HOME</Link> */}
            <Link href="/about" className={linkClass('/about')}>
              ABOUT
            </Link>
            <Link href="/connect" className={linkClass('/connect')}>
              CONNECT
            </Link>
            <Link href="/resources" className={linkClass('/resources')}>
              RESOURCES
            </Link>
            <Link href="/contact" className={linkClass('/contact')}>
              CONTACT US
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-6 pr-6">
            <ThemeToggle />
            {isAuthed ? <UserAvatar initials={initials} onSignOut={handleSignOut} /> : null}
          </div>
        </div>
        {/* Mobile controls (right aligned) */}
        <div className="md:hidden flex items-center gap-4 ml-auto">
          <ThemeToggle />
          <button className="flex items-center" onClick={() => setOpen((v) => !v)} aria-label="Open menu">
            <svg width={28} height={28} fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 7h20M4 14h20M4 21h20" />
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu absolutely positioned with transition */}
      <div
        className={`
          md:hidden flex flex-col items-center gap-4 py-4 transition-all duration-300 ease-in-out origin-top absolute left-0 right-0 top-full w-full bg-muted-foreground z-50
          ${open ? 'opacity-100 scale-y-100 pointer-events-auto' : 'opacity-0 scale-y-0 pointer-events-none'}
        `}>
        {/* Same links for mobile regardless of auth */}
        <>
          {/* <Link
            href="/"
            className="text-lg tracking-widest font-difont hover:underline w-full text-center"
            onClick={() => setOpen(false)}>
            HOME
          </Link> */}
          <Link
            href="/about"
            className="text-lg tracking-widest font-difont hover:underline w-full text-center"
            onClick={() => setOpen(false)}>
            ABOUT
          </Link>
          <Link
            href="/connect"
            className="text-lg tracking-widest font-difont hover:underline w-full text-center"
            onClick={() => setOpen(false)}>
            CONNECT
          </Link>
          <Link
            href="/resources"
            className="text-lg tracking-widest font-difont hover:underline w-full text-center"
            onClick={() => setOpen(false)}>
            RESOURCES
          </Link>
          <Link
            href="/contact"
            className="text-lg tracking-widest font-difont hover:underline w-full text-center"
            onClick={() => setOpen(false)}>
            CONTACT US
          </Link>
          {isAuthed ? (
            <>
              <div className="flex items-center justify-center py-2">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="User menu"
                  className="size-10 rounded-full bg-foreground text-background font-bold flex items-center justify-center">
                  {initials}
                </button>
              </div>
              {menuOpen ? (
                <>
                  <Link
                    href="/profile"
                    className="text-lg tracking-widest hover:underline w-full text-center"
                    onClick={() => {
                      setOpen(false);
                      setMenuOpen(false);
                    }}>
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setMenuOpen(false);
                      handleSignOut();
                    }}
                    className="text-lg tracking-widest hover:underline w-full text-center">
                    Sign out
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </>
      </div>
    </nav>
  );
};

// Export with SSR disabled to prevent window/document access during server rendering
export default dynamic(() => Promise.resolve(Navbar), { ssr: false });
