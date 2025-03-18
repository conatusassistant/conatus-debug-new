import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { LLMRouterProvider } from '@/context/LLMRouterContext';
import { AdaptiveLearningProvider } from '@/context/AdaptiveLearningContext';
import { PerformanceObserver } from '@/components/performance/PerformanceObserver';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const inter = Inter({ subsets: ['latin'] });

// Create a new QueryClient instance
const queryClient = new QueryClient();

export const metadata: Metadata = {
  title: 'Conatus AI',
  description: 'AI Execution Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LLMRouterProvider>
              <AdaptiveLearningProvider>
                <PerformanceObserver />
                {children}
              </AdaptiveLearningProvider>
            </LLMRouterProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}