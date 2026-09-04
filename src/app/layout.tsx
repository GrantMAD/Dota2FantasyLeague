import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PageGuideOverlay } from "../components/PageGuideOverlay";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fantasy Dota 2",
  description: "Global fantasy esports platform for professional Dota 2",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-linear-to-br from-slate-950 to-slate-900 text-white">
        <ThemeProvider>
          {children}
          <Suspense fallback={null}>
            <PageGuideOverlay />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
