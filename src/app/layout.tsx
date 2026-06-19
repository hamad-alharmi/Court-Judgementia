import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as Sonner } from "sonner";
import { ThemeProvider } from "@/components/game/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JUDGEMENTIA — Cyber Legal Trial Protocol",
  description:
    "A real-time multiplayer cyber & corporate legal thriller. Prosecute, defend, object, and face the verdict of Chief Justice Vanguard.",
  keywords: [
    "Judgementia",
    "multiplayer legal game",
    "cyber thriller",
    "courtroom",
    "AI judge",
    "Elo ranked",
  ],
  authors: [{ name: "Judgementia Protocol" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground font-mono-terminal`}
      >
        <ThemeProvider>{children}</ThemeProvider>
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
