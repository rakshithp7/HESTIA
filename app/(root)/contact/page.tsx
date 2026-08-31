'use client';

import React from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useAccessibility } from '@/components/providers/AccessibilityProvider';

export default function ContactPage() {
  const { dyslexicFont } = useAccessibility();

  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const data = new FormData(form);

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          message: data.get('message'),
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        toast.error(
          body?.error ?? 'We could not send your message. Please try again.'
        );
        return;
      }

      form.reset();
      toast.success('Message sent. We sent a copy to your email.');
    } catch {
      toast.error(
        'We could not reach the server. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="my-12 md:mt-24 mx-8">
      <div className="mx-auto max-w-5xl xl:max-w-6xl flex flex-col md:flex-row items-center justify-center gap-10 md:gap-24">
        <div
          className={`select-none font-difont ${dyslexicFont ? 'text-[3rem] md:text-[5rem] leading-[1.5]' : 'text-[5rem] md:text-[8rem] leading-[0.9]'}  w-full md:w-1/2 text-center md:text-left`}
        >
          <p className="m-0">WE ARE</p>
          <p className="m-0">HERE TO</p>
          <p className="m-0 text-primary">
            LISTEN<span className="text-foreground">.</span>
          </p>
        </div>

        <div className="w-full md:w-1/2 md:max-w-md flex justify-center md:justify-end">
          <form onSubmit={onSubmit} className="space-y-4 w-full">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your name"
                className="px-4 py-2 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email<span aria-hidden="true">*</span>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="Enter your email"
                className="px-4 py-2 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-base">
                Message<span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="message"
                name="message"
                rows={5}
                required
                placeholder="Type your message"
                className="px-4 py-2 text-base"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-10">
              {submitting ? 'Sending…' : 'Submit'}
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
                className="object-contain absolute hidden xl:inline-block -top-14 -right-16 rotate-4"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
