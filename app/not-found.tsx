'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative flex flex-col items-center gap-10">
        <DotLottieReact src="/404-anim.lottie" loop autoplay className="w-3/4" />

        <div className="space-y-4 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-semibold">Well, this is awkward.</h1>
          <p className="text-lg">
            He&apos;s stuck trying to get the yarn, and you&apos;re stuck on this page. One of these problems is easier
            to solve. Let&apos;s start with yours.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="text-base font-semibold">
            <Link href="/">Head home</Link>
          </Button>
          <Button asChild variant="outline" className="text-base font-semibold">
            <Link href="/resources">Browse resources</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
