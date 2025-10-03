import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import HeaderClient from '@/components/HeaderClient'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Shaw AI - Invoice Extraction',
  description: 'Offline-first invoice extraction webapp using Chrome\'s built-in AI',
  keywords: ['invoice', 'ai', 'extraction', 'offline', 'chrome-ai'],
  authors: [{ name: 'Shaw AI' }],
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <div className="min-h-full bg-background">
          <HeaderClient />

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border bg-card/30 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <div className="text-lg">🤖</div>
                  <span className="text-sm text-muted-foreground">
                    Shaw AI - Powered by Chrome&apos;s Built-in LanguageModel
                  </span>
                </div>
                
                <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                  <a 
                    href="https://developer.chrome.com/docs/ai/prompt-api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    LanguageModel Docs
                  </a>
                  <span className="text-xs">
                    Version 1.0.0
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Chrome AI availability check script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.LanguageModel) {
                console.warn('Chrome LanguageModel not available. Please use Chrome Canary with LanguageModel features enabled.');
              }
            `,
          }}
        />
      </body>
    </html>
  )
}