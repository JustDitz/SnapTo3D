import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnapTo3D: 3D Product Presentation for UMKM",
  description:
    "Upload a product photo and get an interactive 3D model. Built for Indonesian MSMEs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${GeistMono.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}