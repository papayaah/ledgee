import type { Metadata } from 'next'
import { Inter, Raleway } from 'next/font/google'
import './globals.css'
import FloatingHeader from '@/components/FloatingHeader'
import QueueProcessor from '@/components/QueueProcessor'
import AboutPullout from '@/components/AboutPullout'
import { AIProviderProvider } from '@/contexts/AIProviderContext'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const raleway = Raleway({ 
  subsets: ['latin'],
  variable: '--font-raleway',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ledgee - AI Invoice Extraction for Small Businesses',
  description: 'Perfect for mom-and-pop shops! Ledgee is an offline-first AI invoice extraction tool powered by Chrome\'s built-in AI. Extract invoice data instantly without internet, generate reports, and sync to Google Sheets. Ideal for small businesses, local stores, and independent retailers.',
  keywords: [
    'invoice extraction', 'AI invoice processing', 'offline invoice scanner', 
    'Chrome AI', 'invoice analytics', 'Google Sheets integration', 
    'small business', 'mom and pop shop', 'local business', 'independent retailer',
    'offline invoice processing', 'Chrome built-in AI', 'invoice management', 
    'OCR invoice', 'invoice data extraction', 'business intelligence', 'invoice reporting'
  ],
  authors: [{ name: 'Ledgee Team' }],
  creator: 'Ledgee',
  publisher: 'Ledgee',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shawai.vercel.app',
    siteName: 'Ledgee',
    title: 'Ledgee - AI-Powered Invoice Extraction & Analytics',
    description: 'Perfect for mom-and-pop shops! Ledgee is an offline-first AI invoice extraction tool powered by Chrome\'s built-in AI. Extract invoice data instantly without internet, generate reports, and sync to Google Sheets.',
    images: [
      {
        url: '/imgs/screenshots/dashboard.jpg',
        width: 1200,
        height: 630,
        alt: 'Ledgee Dashboard - AI Invoice Extraction and Analytics',
        type: 'image/jpeg',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@papayaahtries',
    creator: '@papayaahtries',
    title: 'Ledgee - AI-Powered Invoice Extraction & Analytics',
    description: 'Perfect for mom-and-pop shops! Ledgee is an offline-first AI invoice extraction tool powered by Chrome\'s built-in AI. Extract invoice data instantly without internet.',
    images: ['/imgs/screenshots/dashboard.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Add your Google Search Console verification code
  },
  alternates: {
    canonical: 'https://shawai.vercel.app',
  },
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
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Ledgee",
              "description": "AI-powered invoice extraction and analytics tool for small businesses, mom-and-pop shops, and local retailers using Chrome's built-in AI. Works offline, syncs to Google Sheets.",
              "url": "https://shawai.vercel.app",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "creator": {
                "@type": "Organization",
                "name": "Ledgee Team"
              },
              "featureList": [
                "AI Invoice Extraction",
                "Offline Processing",
                "Google Sheets Integration",
                "Analytics Dashboard",
                "Chrome AI Integration",
                "Multi-currency Support",
                "Small Business Focus",
                "Mom-and-Pop Shop Friendly"
              ],
              "codeRepository": "https://github.com/papayaah/ledgee",
              "supportUrl": "https://strostudio.com",
              "screenshot": "https://shawai.vercel.app/imgs/screenshots/dashboard.jpg"
            })
          }}
        />
      </head>
      <body className={`${inter.variable} ${raleway.variable} h-full antialiased`}>
              <AIProviderProvider>
                {/* Global queue processor - extracts data in background */}
                <QueueProcessor />
                
                <div className="min-h-full bg-background flex flex-col">
                  {/* Floating header */}
                  <FloatingHeader />

                  {/* Main content */}
                  <main className="flex-1 pb-20 flex flex-col">
                    {children}
                  </main>

                  {/* About pullout */}
                  <AboutPullout />

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
        </AIProviderProvider>
        <Analytics />
      </body>
    </html>
  )
}