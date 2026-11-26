import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_TITLE = "Nittin ERP | Order-to-Audit Manufacturing";
const SITE_DESCRIPTION =
  "Production-grade Order-to-Audit ERP for packaged food manufacturing: offline-ready field orders, BOM batch costing, FIFO stock ledger, GST invoicing, and statutory Tally exports.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  applicationName: "Nittin ERP",
  title: {
    template: "%s | Nittin ERP",
    default: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Manufacturing ERP",
    "Food Manufacturing ERP",
    "GST Billing",
    "BOM Costing",
    "FIFO Inventory",
    "Order to Audit",
    "Tally XML Export",
  ],
  authors: [{ name: "Nittin Foods Pvt. Ltd." }],
  manifest: "/manifest.json",
  icons: {
    icon: "/nittin.png",
    apple: "/nittin.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nittin ERP",
  },
  openGraph: {
    type: "website",
    siteName: "Nittin ERP",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/nittin.png", width: 512, height: 512, alt: "Nittin ERP Logo" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/nittin.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#16100c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-[var(--bg-canvas)] font-sans text-[var(--text-primary)] antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
