'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useTheme } from '@/components/theme-provider';

export default function NotFound() {
  const { theme } = useTheme();

  // const animationSrc =
  //   theme === 'dark'
  //     ? 'https://lottie.host/6b15ec54-ed7f-4403-b465-ce2446497b19/xaCN3TDHzb.lottie'
  //     : 'https://lottie.host/69d9dd64-a9bd-40fe-b9ac-0e359eb4f438/GsrMFFEmZh.lottie';
  const animationSrc = theme === 'dark' ? '/404-error-page-dark.lottie' : '/404-error-page-light.lottie';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative flex flex-col items-center gap-10">
        <DotLottieReact src={animationSrc} loop autoplay className="w-[100vw] md:w-[50vw]" />

        <div className="space-y-4 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-semibold">Well, this is awkward.</h1>
          <p className="text-lg">
            Our cat&apos;s stuck trying to get the yarn, and you&apos;re stuck on this page. One of these problems is
            easier to solve. Let&apos;s start with yours.
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
