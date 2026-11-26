import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SessionProvider } from "@/components/SessionProvider";
import { TourTriggerButton } from "@/components/TourTriggerButton";
import { TourOverlays } from "@/components/TourOverlays";
import { TelemetryPageTracker } from "@/components/TelemetryPageTracker";
import { TourProvider } from "@/context/TourContext";
import { ToastProvider } from "@/components/Toast/ToastContext";
import { ToastContainer } from "@/components/Toast/ToastContainer";
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
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('sidebar-collapsed') === 'true') {
                  document.documentElement.dataset.sidebarCollapsed = 'true';
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>
              <TourProvider>
                {children}
                <Suspense fallback={null}>
                  <TelemetryPageTracker />
                  <TourTriggerButton />
                  <TourOverlays />
                </Suspense>
              </TourProvider>
              <ToastContainer />
            </ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
