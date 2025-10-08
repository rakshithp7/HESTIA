import type { Metadata } from 'next';
import { Unna } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import Navbar from '@/components/Navbar';
import { AppToaster } from '@/components/ui/sonner-toaster';

const unna = Unna({
  variable: '--font-unna',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const difont = localFont({
  src: [{ path: '/fonts/difont.ttf' }],
  variable: '--font-difont',
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
      <body className={`${unna.variable} ${difont.variable} antialiased`}>
        <ThemeProvider>
          <div className="relative">
            <Navbar />
            {children}
          </div>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
