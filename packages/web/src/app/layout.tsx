import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { QueryProvider } from '../providers/query-provider';
import { ToastContainer } from '../components/ui/Toast';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: { default: 'FlowBoard', template: '%s — FlowBoard' },
  description: 'Real-time collaborative project management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <QueryProvider>
          {children}
          <ToastContainer />
        </QueryProvider>
      </body>
    </html>
  );
}
