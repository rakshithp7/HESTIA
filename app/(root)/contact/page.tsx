'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <div className="my-12 md:mt-24 mx-8">
      <div className="mx-auto max-w-5xl xl:max-w-6xl grid grid-cols-1 md:grid-cols-2 items-center place-content-center gap-10">
        <div className="select-none font-difont text-[5rem] md:text-[8rem] leading-[0.9] tracking-wide">
          <p className="m-0">WE ARE</p>
          <p className="m-0">HERE TO</p>
          <p className="m-0 text-primary">
            LISTEN<span className="text-foreground">.</span>
          </p>
        </div>

        <div className="w-full md:max-w-lg md:justify-self-center">
          <form onSubmit={onSubmit} className="space-y-4 w-full">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-base">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your name"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-base">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="block text-base">
                Message<span aria-hidden="true">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                placeholder="Type your message"
                className="w-full rounded-md border border-border bg-input px-4 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <Button type="submit" className="w-full h-10">
              Submit
            </Button>

            <div className="flex relative place-content-center">
              <p className="text-center text-sm mt-2">
                Have a question? Check out our{' '}
                <Link href="/about" className="underline underline-offset-4">
                  About Page
                </Link>{' '}
                for some FAQs!
              </p>
              <Image
                src="/logo.svg"
                alt="Logo"
                width={90}
                height={90}
                className="object-contain absolute hidden md:inline-block -top-14 -right-16 rotate-4"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
