import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="screen-height flex items-center justify-center p-4">
      <div className="flex flex-col md:flex-row items-center mt-40 gap-8 md:gap-12">
        <div className="min-w-[150px] md:min-w-[200px]">
          <Image
            src="/logo.svg"
            alt="Hestia Logo"
            width={200}
            height={240}
            priority
            className="object-contain md:m-auto w-[150px] md:w-[200px] drop-shadow-[1px_1px_1px_#236971] dark:drop-shadow-none"
          />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-[6rem] md:text-[12rem] tracking-wider m-0 leading-none font-difont preserve-font -mb-8 md:-mb-16 -mt-4 md:mt-12">
            HESTIA
          </h1>
          <p className="text-xl md:text-3xl my-4 md:my-8">
            Creating a safe space for all, founded on connection.
          </p>
          <div className="flex justify-center gap-4 md:gap-8">
            <Button asChild className="text-base font-bold md:text-lg">
              <Link href="/connect">Connect to chat</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="text-base font-bold md:text-lg"
            >
              <Link href="/resources">View resources</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
