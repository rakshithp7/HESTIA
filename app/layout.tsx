import type { Metadata } from 'next';
import { Unna } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AccessibilityProvider } from '@/components/providers/AccessibilityProvider';
import { RTCSessionProvider } from '@/components/providers/RTCSessionProvider';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/ui/sonner';
import { FloatingSessionWindow } from '@/components/session/FloatingSessionWindow';
import { ConnectedSessionStatusBar } from '@/components/session/ConnectedSessionStatusBar';
import { SessionTitleHandler } from '@/components/session/SessionTitleHandler';

const unna = Unna({
  variable: '--font-unna',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const difont = localFont({
  src: [{ path: '/fonts/difont.ttf' }],
  variable: '--font-difont',
});

const openDyslexic = localFont({
  src: [
    {
      path: './fonts/opendyslexic-0.92/OpenDyslexic-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/opendyslexic-0.92/OpenDyslexic-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/opendyslexic-0.92/OpenDyslexic-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/opendyslexic-0.92/OpenDyslexic-BoldItalic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-dyslexic',
});

export const metadata: Metadata = {
  title: 'Hestia - Creating a safe space for all, founded on connection.',
  description:
    'Hestia is a completely free and anonymous chat service that allows you to talk to another community member in your age group based on your choice of topic. Our aim is to provide a judgement-free space founded on human connection, understanding, and unity.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${unna.variable} ${difont.variable} ${openDyslexic.variable} antialiased`}
      >
        <ThemeProvider>
          <AccessibilityProvider>
            <RTCSessionProvider>
              <div className="relative">
                <ConnectedSessionStatusBar />
                <Navbar />
                {children}
                <FloatingSessionWindow />
                <SessionTitleHandler />
              </div>
              <Toaster />
            </RTCSessionProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
