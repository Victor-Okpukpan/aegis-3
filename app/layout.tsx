import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis-3 | Adversarial Smart Contract Auditor',
  description: 'AI-powered semantic context auditor for smart contracts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#000000',
              color: '#e2e8f0',
              border: '1px solid #1e293b',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#000000',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#000000',
              },
              duration: 7000,
            },
          }}
        />
      </body>
    </html>
  );
}
