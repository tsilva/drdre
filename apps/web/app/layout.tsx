import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, IBM_Plex_Sans } from "next/font/google";

import "./globals.css";

const SITE_URL = "https://drdre.tsilva.eu";
const SITE_TITLE = "DR.DRE | Semantic Search for Diário da República";
const SITE_DESCRIPTION = "Free semantic and citation-first search engine for Portugal's Diário da República (Official Journal). Hybrid search combining full-text and AI-powered semantic vectors. Browser-side embeddings for privacy.";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Diário da República",
    "Portugal laws",
    "legal search",
    "semantic search",
    "citation search",
    "Portuguese legislation",
    "DR search",
    "legal documents",
    "hybrid search",
    "FTS5",
    "vector search",
    "AI search",
    "free legal tool",
    "privacy focused",
  ],
  authors: [{ name: "Tiago Silva" }],
  creator: "Tiago Silva",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Semantic and citation-first search for Portugal's Diário da República. Free, privacy-focused legal document search with AI-powered results.",
    type: "website",
    url: SITE_URL,
    siteName: "DR.DRE",
    locale: "pt_PT",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Search Portugal's Diário da República with semantic AI. Free and privacy-focused.",
    creator: "@tiagosilva",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DR.DRE",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  author: {
    "@type": "Person",
    name: "Tiago Silva",
    url: "https://www.tsilva.eu",
  },
  applicationCategory: "ReferenceApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
