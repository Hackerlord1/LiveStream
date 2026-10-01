// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const inter = Inter({
    subsets: ["latin"],
    display: 'swap',
    variable: '--font-inter',
});

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    colorScheme: 'light dark',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#e8e8e8' },
        { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
    ],
}

export const metadata: Metadata = {
    metadataBase: new URL('https://bravestream.live'),
    title: {
        default: 'BraveStream - Live Sports Streaming in HD | Football, NBA, NFL, NHL',
        template: '%s | BraveStream Live Sports'
    },
    description: 'Watch live sports streams in HD quality for free. Live football, NBA, NFL, NHL, boxing, UFC, and more. No blackouts, no restrictions. Join thousands of sports fans watching now!',
    keywords: [
        'live sports streaming',
        'free sports streams',
        'football live stream',
        'NBA live stream',
        'NFL live stream',
        'NHL live stream',
        'boxing live stream',
        'UFC live stream',
        'soccer streams',
        'premier league live',
        'champions league',
        'la liga',
        'serie a',
        'bundesliga',
        'mlb live',
        'mls live',
        'formula 1 live',
        'tennis live',
        'rugby live',
        'cricket live',
    ],
    authors: [{ name: 'BraveStream Team' }],
    creator: 'BraveStream',
    publisher: 'BraveStream',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
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
    openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://bravestream.live',
        siteName: 'BraveStream',
        title: 'BraveStream - Live Sports Streaming in HD',
        description: 'Watch live sports streams in HD quality for free. Live football, NBA, NFL, NHL, boxing, UFC, and more.',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'BraveStream Live Sports',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'BraveStream - Live Sports Streaming in HD',
        description: 'Watch live sports streams in HD quality for free. Live football, NBA, NFL, NHL, boxing, UFC, and more.',
        images: ['/twitter-image.png'],
        creator: '@bravestream',
    },
    verification: {
        google: 'your-google-verification-code',
        yandex: 'your-yandex-verification-code',
        yahoo: 'your-yahoo-verification-code',
    },
    alternates: {
        canonical: 'https://bravestream.live',
        languages: {
            'en-US': 'https://bravestream.live',
        },
    },
    category: 'sports',
    classification: 'Sports Streaming Service',
    icons: {
        icon: [{ url: '/favicon.ico' }],
    },
    manifest: '/manifest.json',
    other: {
        'application-name': 'BraveStream',
        'apple-mobile-web-app-title': 'BraveStream',
        'mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-capable': 'yes',
        'apple-mobile-web-app-status-bar-style': 'black-translucent',
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "SportsOrganization",
                            "name": "BraveStream",
                            "url": "https://bravestream.live",
                            "logo": "https://bravestream.live/logo.png",
                            "description": "Free live sports streaming platform for football, basketball, American football, hockey, and more.",
                            "founder": { "@type": "Person", "name": "BraveStream Team" },
                            "foundingDate": "2024",
                            "sameAs": ["https://twitter.com/bravestream", "https://facebook.com/bravestream"],
                            "knowsAbout": ["Live Sports Streaming", "Football", "Basketball", "American Football", "Hockey", "Tennis", "Boxing", "MMA"]
                        })
                    }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "WebSite",
                            "url": "https://bravestream.live",
                            "name": "BraveStream",
                            "description": "Live sports streaming platform"
                        })
                    }}
                />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://api.bravestream.live" />
            </head>
            <body
                className={`${inter.className} antialiased transition-colors duration-300`}
                style={{
                    backgroundColor: 'var(--neu-bg-page)',
                    color: 'var(--text-secondary)',
                }}
                suppressHydrationWarning
            >
                <ConvexClientProvider>
                    <main className="min-h-screen">
                        {children}
                    </main>
                </ConvexClientProvider>
            </body>
        </html>
    );
}