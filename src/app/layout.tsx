import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { PageTour } from "@/components/PageTour";
import { PageGuideModal } from "@/components/PageGuideModal";
import { TourTriggerButton } from "@/components/TourTriggerButton";
import { TelemetryPageTracker } from "@/components/TelemetryPageTracker";
import { TourProvider } from "@/context/TourContext";
import { HeaderDataProvider } from "@/context/HeaderDataContext";
import { ToastProvider } from "@/components/Toast/ToastContext";
import { ToastContainer } from "@/components/Toast/ToastContainer";
import { DataFreshnessProvider } from "@/context/DataFreshnessContext";
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
    icon: "/Images/Dota2FantasyLeagueLogo-mark.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-screen bg-linear-to-br from-slate-950 to-slate-900 text-white">
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>
              <HeaderDataProvider>
                <DataFreshnessProvider>
                  <TourProvider>
                    {children}
                    <Suspense fallback={null}>
                      <TelemetryPageTracker />
                      <PageTour />
                      <PageGuideModal />
                      <TourTriggerButton />
                    </Suspense>
                  </TourProvider>
                </DataFreshnessProvider>
              </HeaderDataProvider>
              <ToastContainer />
            </ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
