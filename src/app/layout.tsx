import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "sonner";
import { ThemeProvider } from "@/components/game/ThemeProvider";
import { AdProvider } from "@/lib/ads";
import { FirstVisitDialog } from "@/components/game/FirstVisitDialog";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JUDGEMENTIA — Legal Trial Protocol",
  description:
    "A real-time multiplayer legal thriller. Prosecute, defend, object, and face the verdict of Chief Justice Vanguard.",
  keywords: [
    "Judgementia",
    "multiplayer legal game",
    "courtroom",
    "trial",
    "AI judge",
    "Elo ranked",
  ],
  authors: [{ name: "Judgementia" }],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Adsterra Popunder */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://pl29892584.effectivecpmnetwork.com/51/46/17/514617bde1865162aebd289bf65f3920.js" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground font-mono-terminal`}
      >
        <ThemeProvider>
          <AdProvider>
            {children}
            <FirstVisitDialog />
          </AdProvider>
        </ThemeProvider>
        <Sonner
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--panel)",
              border: "1px solid color-mix(in oklab, var(--gold) 50%, transparent)",
              color: "var(--foreground)",
              fontFamily: "var(--font-geist-mono), monospace",
              borderRadius: 0,
            },
          }}
        />
      </body>
    </html>
  );
}
