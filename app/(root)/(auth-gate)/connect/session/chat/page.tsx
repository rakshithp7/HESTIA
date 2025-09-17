'use client';

import React from 'react';

export default function ChatSessionPage() {
  return (
    <div className="relative">
      {/* Chat bubbles mock */}
      <div className="space-y-16">
        <div className="max-w-xl rounded-2xl border-2 border-primary/60 bg-card/40 p-4">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
          magna aliqua.
        </div>
        <div className="flex justify-end">
          <div className="max-w-xl rounded-2xl border-2 border-foreground bg-foreground text-background p-4">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua.
          </div>
        </div>
        <div className="max-w-sm rounded-2xl border-2 border-primary/60 bg-card/40 p-4">Typing…</div>
      </div>

      {/* Composer */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-8 w-[80%] max-w-3xl">
        <div className="flex items-center gap-2 rounded-full border bg-input px-5 py-3">
          <input className="flex-1 bg-transparent outline-none" placeholder="Your message here..." />
          <button className="opacity-80" aria-label="Send">
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
