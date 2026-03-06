import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PostHogPageView from "@/components/PostHogPageView";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fund-returns.altsight.ai"),
  title: {
    default: "Alternative Assets Returns | AltSight",
    template: "%s | AltSight",
  },
  description:
    "Data on private equity, venture capital, and alternative investment performance. IRR, TVPI, and DPI data from public pension disclosures.",
  keywords: [
    "alternative assets",
    "pension fund returns",
    "private equity performance",
    "venture capital IRR",
    "TVPI",
    "DPI",
    "CalPERS",
    "pension fund holdings",
  ],
  openGraph: {
    title: "Alternative Assets Returns | AltSight",
    description:
      "Track pension fund PE, VC, and alternative investment performance with IRR, TVPI, and DPI data.",
    url: "https://fund-returns.altsight.ai",
    siteName: "AltSight",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Alternative Assets Returns | AltSight",
    description:
      "Track pension fund PE, VC, and alternative investment performance.",
  },
  alternates: {
    canonical: "https://fund-returns.altsight.ai",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const posthogApiKey = process.env.POSTHOG_API_KEY;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PostHogPageView apiKey={posthogApiKey} />
        {children}
      </body>
    </html>
  );
}
