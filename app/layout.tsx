import type React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import localFont from 'next/font/local';

const pretendard = localFont({
  src: [
    {
      path: '../public/fonts/Pretendard-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/Pretendard-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-pretendard',
});

export const metadata = {
  title: '서지 정보 검증 도구',
  description: 'CSV 파일을 업로드하고 네이버 API를 통해 도서 정보를 검증하는 도구',
  generator: 'v0.dev',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${pretendard.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
