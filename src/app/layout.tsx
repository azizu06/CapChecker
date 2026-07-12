import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/components/site-header";

const instrumentDisplay = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentBody = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CapCheck — Financial advice, fact-checked",
  description: "Check short-form financial claims against credible evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentDisplay.variable} ${instrumentBody.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
