import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ThemeToggle />

      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <div className="min-w-[150px] md:min-w-[200px]">
          <Image
            src="/logo.png"
            alt="Hestia Logo"
            width={200}
            height={240}
            priority
            className="object-contain w-[150px] md:w-[200px]"
          />
        </div>
        <div className="text-center">
          <h1 className="text-[6rem] md:text-[12rem] tracking-wider m-0 leading-none font-hestia -mb-8 md:-mb-16 mt-6 md:mt-12">
            HESTIA
          </h1>
          <p className="text-xl md:text-3xl my-4 md:my-8">Creating a safe space for all, founded on connection.</p>
          <Button asChild variant="outline" className="text-base font-bold md:text-lg">
            <Link href="/age-verification">Connect to chat</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
