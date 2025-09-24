import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";

const display = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "PulseShift | Hyper-visual SEC radar for traders",
  description:
    "PulseShift turns EDGAR filings into a neon command center. Track tickers, surface fresh filings and feel market-moving changes before the crowd.",
  openGraph: {
    title: "PulseShift | Hyper-visual SEC radar for traders",
    description:
      "Light up your next trade. PulseShift condenses SEC filings into a colorful, game-inspired dashboard built for day traders and analysts.",
    url: "https://pulseshift.example",
    siteName: "PulseShift",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PulseShift | Hyper-visual SEC radar for traders",
    description:
      "Streamline SEC filings with real-time heat maps, alerts and competitive intel crafted for the trading floor.",
  },
  metadataBase: new URL("https://pulseshift.example"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="app-shell">{children}</body>
    </html>
  );
}
